from django.db.models import Count, Q
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsManager, IsManagerOrEngineer, IsManagerOrReadOnly
from apps.audit.models import AuditLogEntry
from apps.organizations.mixins import OrganizationQuerySetMixin
from apps.projects.models import Epic, Project
from apps.projects.serializers import (
    AssigneeSerializer,
    EpicCreateEngineerSerializer,
    EpicCreateSerializer,
    EpicDetailSerializer,
    EpicListSerializer,
    EpicStatusChangeSerializer,
    EpicUpdateEngineerSerializer,
    EpicUpdateSerializer,
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectStatusChangeSerializer,
    ProjectUpdateSerializer,
)
from apps.projects.services import apply_epic_status_change, apply_project_status_change
from apps.tasks.serializers import TaskListSerializer

# ---------------------------------------------------------------------------
# ProjectViewSet
# ---------------------------------------------------------------------------

@extend_schema_view(
    list=extend_schema(
        tags=["Projects"],
        summary="List projects",
        description="Paginated project list with filtering and search.",
        parameters=[
            OpenApiParameter("status", type=str, enum=["created", "in_progress", "waiting", "done", "archived"], description="Filter by status"),
            OpenApiParameter("priority", type=str, enum=["low", "medium", "high", "critical"], description="Filter by priority"),
            OpenApiParameter("client", type=int, description="Filter by client ID"),
            OpenApiParameter("search", type=str, description="Search in title and description"),
            OpenApiParameter("ordering", type=str, description="Order by field (prefix with - for desc). Options: created_at, deadline, priority, title"),
        ],
    ),
    create=extend_schema(
        tags=["Projects"],
        summary="Create a project",
        description="Manager-only. Creates a new project in the current user's organization.",
        responses={201: ProjectDetailSerializer},
    ),
    retrieve=extend_schema(tags=["Projects"], summary="Get project details"),
    partial_update=extend_schema(
        tags=["Projects"],
        summary="Update a project",
        description="Manager-only. Uses optimistic locking via version field — returns 409 on concurrent edit conflict.",
        responses={200: ProjectDetailSerializer, 409: OpenApiResponse(description="Optimistic lock conflict")},
    ),
    destroy=extend_schema(
        tags=["Projects"],
        summary="Delete a project",
        description="Manager-only. Permanently deletes a project.",
    ),
)
class ProjectViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = Project.objects.all()
    filterset_fields = ["priority", "client"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "deadline", "priority", "title"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy", "change_status"):
            return [IsManager()]
        return [IsManagerOrReadOnly()]

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related("assignee", "client", "created_by").prefetch_related("tags")

        if self.action == "list":
            qs = qs.annotate(
                epics_count=Count("epics", distinct=True),
            )

        explicit_status = self.request.query_params.get("status")
        if explicit_status:
            qs = qs.filter(status=explicit_status)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        return qs

    def get_serializer_class(self):
        if getattr(self, "swagger_fake_view", False):
            return ProjectDetailSerializer
        if self.action == "list":
            return ProjectListSerializer
        if self.action == "create":
            return ProjectCreateSerializer
        if self.action in ("update", "partial_update"):
            return ProjectUpdateSerializer
        return ProjectDetailSerializer

    @extend_schema(
        tags=["Projects"],
        summary="Change project status",
        description="Manager-only. Any status transition is allowed.",
        request=ProjectStatusChangeSerializer,
        responses={
            200: inline_serializer("ProjectStatusChangeResponse", fields={
                "id": drf_serializers.IntegerField(),
                "status": drf_serializers.CharField(),
                "previous_status": drf_serializers.CharField(allow_null=True),
                "changed_by": AssigneeSerializer(),
                "changed_at": drf_serializers.DateTimeField(),
            }),
            400: OpenApiResponse(description="Invalid request"),
            409: OpenApiResponse(description="Optimistic lock conflict"),
        },
    )
    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        project = self.get_object()
        serializer = ProjectStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        user = request.user

        success, error, updated_project = apply_project_status_change(project, new_status, user)
        if not success:
            if "Conflict" in (error or ""):
                return Response(
                    {"detail": error, "code": "conflict"},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {"detail": error, "code": "invalid_status_change"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "id": updated_project.id,
            "status": updated_project.status,
            "previous_status": project.status if project.status != updated_project.status else None,
            "changed_by": {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "changed_at": updated_project.updated_at,
        })

    @extend_schema(
        tags=["Projects"],
        summary="List epics under this project",
        description="Paginated list of epics belonging to this project.",
        responses={200: EpicListSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="epics")
    def epics(self, request, pk=None):
        project = self.get_object()
        qs = Epic.objects.filter(
            project=project, organization=request.user.organization
        ).select_related(
            "project", "assignee", "client"
        ).prefetch_related("tags").annotate(
            tasks_count=Count("tasks", filter=Q(tasks__parent_task__isnull=True), distinct=True),
        ).order_by("-created_at")

        page = self.paginate_queryset(qs)
        serializer = EpicListSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Projects"],
        summary="Get project audit history",
        description="Paginated list of all changes to this project. Manager and engineer only.",
        responses={
            200: inline_serializer("ProjectAuditHistoryEntry", fields={
                "id": drf_serializers.IntegerField(),
                "action": drf_serializers.CharField(),
                "field": drf_serializers.CharField(),
                "old_value": drf_serializers.CharField(allow_null=True),
                "new_value": drf_serializers.CharField(allow_null=True),
                "changed_by": AssigneeSerializer(allow_null=True),
                "changed_at": drf_serializers.DateTimeField(),
            }, many=True),
            403: OpenApiResponse(description="Clients cannot view audit history"),
        },
    )
    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        project = self.get_object()
        if request.user.role not in ("manager", "engineer"):
            return Response(
                {"detail": "Only managers and engineers can view audit history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entries = AuditLogEntry.objects.filter(project=project).select_related("actor")
        page = self.paginate_queryset(entries)
        data = [
            {
                "id": e.id,
                "action": e.action,
                "field": e.field_name,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "changed_by": {
                    "id": e.actor.id,
                    "first_name": e.actor.first_name,
                    "last_name": e.actor.last_name,
                } if e.actor else None,
                "changed_at": e.timestamp,
            }
            for e in page
        ]
        return self.get_paginated_response(data)


# ---------------------------------------------------------------------------
# EpicViewSet
# ---------------------------------------------------------------------------

@extend_schema_view(
    list=extend_schema(
        tags=["Epics"],
        summary="List epics",
        description="Paginated epic list with filtering and search. Use ?standalone=true for epics without a project.",
        parameters=[
            OpenApiParameter("project", type=int, description="Filter by project ID"),
            OpenApiParameter("standalone", type=bool, description="If true, return only epics without a project"),
            OpenApiParameter("status", type=str, enum=["created", "in_progress", "waiting", "done", "archived"], description="Filter by status"),
            OpenApiParameter("priority", type=str, enum=["low", "medium", "high", "critical"], description="Filter by priority"),
            OpenApiParameter("search", type=str, description="Search in title and description"),
            OpenApiParameter("ordering", type=str, description="Order by field (prefix with - for desc). Options: created_at, deadline, priority, title"),
        ],
    ),
    create=extend_schema(
        tags=["Epics"],
        summary="Create an epic",
        description="Manager: full fields (assignee_id, client_id, project_id). Engineer: limited fields (no assignee_id, client_id).",
        responses={201: EpicDetailSerializer},
    ),
    retrieve=extend_schema(tags=["Epics"], summary="Get epic details"),
    partial_update=extend_schema(
        tags=["Epics"],
        summary="Update an epic",
        description=(
            "Uses optimistic locking via version field — returns 409 on concurrent edit conflict. "
            "Engineers can only edit epics they are assigned to and cannot change project_id, assignee_id, or client_id."
        ),
        responses={200: EpicDetailSerializer, 409: OpenApiResponse(description="Optimistic lock conflict")},
    ),
    destroy=extend_schema(
        tags=["Epics"],
        summary="Delete an epic",
        description="Manager-only. Permanently deletes an epic.",
    ),
)
class EpicViewSet(OrganizationQuerySetMixin, viewsets.ModelViewSet):
    queryset = Epic.objects.all()
    filterset_fields = ["priority", "client"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "deadline", "priority", "title"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "change_status"):
            return [IsManagerOrEngineer()]
        if self.action == "destroy":
            return [IsManager()]
        return [IsManagerOrReadOnly()]

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related("project", "assignee", "client", "created_by").prefetch_related("tags")

        if self.action == "list":
            qs = qs.annotate(
                tasks_count=Count("tasks", filter=Q(tasks__parent_task__isnull=True), distinct=True),
            )

        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)

        standalone = self.request.query_params.get("standalone")
        if standalone and standalone.lower() in ("true", "1"):
            qs = qs.filter(project__isnull=True)

        explicit_status = self.request.query_params.get("status")
        if explicit_status:
            qs = qs.filter(status=explicit_status)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        return qs

    def get_serializer_class(self):
        if getattr(self, "swagger_fake_view", False):
            return EpicDetailSerializer
        if self.action == "list":
            return EpicListSerializer
        if self.action == "create":
            if self.request.user.role == "engineer":
                return EpicCreateEngineerSerializer
            return EpicCreateSerializer
        if self.action in ("update", "partial_update"):
            if self.request.user.role == "engineer":
                return EpicUpdateEngineerSerializer
            return EpicUpdateSerializer
        return EpicDetailSerializer

    def perform_update(self, serializer):
        if self.request.user.role == "engineer":
            epic = self.get_object()
            if epic.assignee_id != self.request.user.pk:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Engineers can only edit epics they are assigned to.")
        serializer.save()

    @extend_schema(
        tags=["Epics"],
        summary="Change epic status",
        description="Manager-only. Any status transition is allowed.",
        request=EpicStatusChangeSerializer,
        responses={
            200: inline_serializer("EpicStatusChangeResponse", fields={
                "id": drf_serializers.IntegerField(),
                "status": drf_serializers.CharField(),
                "previous_status": drf_serializers.CharField(allow_null=True),
                "changed_by": AssigneeSerializer(),
                "changed_at": drf_serializers.DateTimeField(),
            }),
            400: OpenApiResponse(description="Invalid request"),
            409: OpenApiResponse(description="Optimistic lock conflict"),
        },
    )
    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        epic = self.get_object()
        user = request.user

        if user.role != "manager":
            return Response(
                {"detail": "Only managers can change epic status."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = EpicStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]

        success, error, updated_epic = apply_epic_status_change(epic, new_status, user)
        if not success:
            if "Conflict" in (error or ""):
                return Response(
                    {"detail": error, "code": "conflict"},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {"detail": error, "code": "invalid_status_change"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "id": updated_epic.id,
            "status": updated_epic.status,
            "previous_status": epic.status if epic.status != updated_epic.status else None,
            "changed_by": {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "changed_at": updated_epic.updated_at,
        })

    @extend_schema(
        tags=["Epics"],
        summary="List top-level tasks under this epic",
        description="Paginated list of tasks belonging to this epic (only top-level, no subtasks).",
        responses={200: TaskListSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="tasks")
    def tasks(self, request, pk=None):
        from apps.tasks.models import Task

        epic = self.get_object()
        qs = Task.objects.filter(
            epic=epic,
            parent_task__isnull=True,
            organization=request.user.organization,
        ).select_related(
            "client", "created_by"
        ).prefetch_related("assignees", "tags").annotate(
            comments_count=Count("comments", distinct=True),
            attachments_count=Count("attachments", distinct=True),
        ).order_by("-created_at")

        page = self.paginate_queryset(qs)
        serializer = TaskListSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Epics"],
        summary="Get epic audit history",
        description="Paginated list of all changes to this epic. Manager and engineer only.",
        responses={
            200: inline_serializer("EpicAuditHistoryEntry", fields={
                "id": drf_serializers.IntegerField(),
                "action": drf_serializers.CharField(),
                "field": drf_serializers.CharField(),
                "old_value": drf_serializers.CharField(allow_null=True),
                "new_value": drf_serializers.CharField(allow_null=True),
                "changed_by": AssigneeSerializer(allow_null=True),
                "changed_at": drf_serializers.DateTimeField(),
            }, many=True),
            403: OpenApiResponse(description="Clients cannot view audit history"),
        },
    )
    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        epic = self.get_object()
        if request.user.role not in ("manager", "engineer"):
            return Response(
                {"detail": "Only managers and engineers can view audit history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        entries = AuditLogEntry.objects.filter(epic=epic).select_related("actor")
        page = self.paginate_queryset(entries)
        data = [
            {
                "id": e.id,
                "action": e.action,
                "field": e.field_name,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "changed_by": {
                    "id": e.actor.id,
                    "first_name": e.actor.first_name,
                    "last_name": e.actor.last_name,
                } if e.actor else None,
                "changed_at": e.timestamp,
            }
            for e in page
        ]
        return self.get_paginated_response(data)
