from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema, extend_schema_field
from rest_framework import generics, serializers

from apps.accounts.permissions import IsClient
from apps.tasks.models import Task


class PortalTicketListSerializer(serializers.ModelSerializer):
    public_comments_count = serializers.IntegerField(read_only=True, default=0)
    attachments_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "status", "priority", "deadline",
            "created_at", "updated_at", "public_comments_count",
            "attachments_count",
        ]


class PortalTicketDetailSerializer(serializers.ModelSerializer):
    comments = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "status", "priority",
            "deadline", "created_at", "updated_at", "comments",
            "attachments",
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_comments(self, obj):
        comments = obj.comments.filter(is_public=True).select_related("author")
        return [
            {
                "id": c.id,
                "author": {
                    "id": c.author.id,
                    "first_name": c.author.first_name,
                    "last_name": c.author.last_name,
                },
                "content": c.content,
                "created_at": c.created_at,
            }
            for c in comments
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_attachments(self, obj):
        attachments = obj.attachments.all()
        return [
            {
                "id": a.id,
                "filename": a.original_filename,
                "file_size": a.file_size,
                "content_type": a.content_type,
                "uploaded_at": a.uploaded_at,
                "download_url": f"/api/tasks/{obj.id}/attachments/{a.id}/",
            }
            for a in attachments
        ]


@extend_schema(
    tags=["Portal"],
    summary="List portal tickets",
    description="Client-role only. Shows tickets for the user's linked client. Excludes archived tasks.",
)
class PortalTicketListView(generics.ListAPIView):
    serializer_class = PortalTicketListSerializer
    permission_classes = [IsClient]
    filterset_fields = ["status"]
    search_fields = ["title"]
    ordering_fields = ["created_at", "deadline"]
    ordering = ["-created_at"]
    queryset = Task.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()
        user = self.request.user
        if not user.client_id:
            return Task.objects.none()
        return (
            Task.objects.filter(client_id=user.client_id, organization=user.organization)
            .exclude(status="archived")
            .annotate(
                public_comments_count=Count("comments", filter=Q(comments__is_public=True)),
                attachments_count=Count("attachments"),
            )
        )


@extend_schema(
    tags=["Portal"],
    summary="Get portal ticket detail",
    description="Client-role only. Includes public comments and attachments.",
)
class PortalTicketDetailView(generics.RetrieveAPIView):
    serializer_class = PortalTicketDetailSerializer
    permission_classes = [IsClient]
    queryset = Task.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()
        user = self.request.user
        if not user.client_id:
            return Task.objects.none()
        return Task.objects.filter(client_id=user.client_id, organization=user.organization).prefetch_related(
            "comments__author", "attachments"
        )
