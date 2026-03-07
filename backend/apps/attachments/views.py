from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsManager
from apps.attachments.models import Attachment
from apps.attachments.serializers import AttachmentSerializer, AttachmentUploadSerializer
from apps.audit.models import AuditLogEntry
from apps.audit.services import create_audit_entry
from apps.tasks.models import Task


@extend_schema_view(
    list=extend_schema(tags=["Attachments"], summary="List attachments for a task"),
    create=extend_schema(
        tags=["Attachments"],
        summary="Upload a file to a task",
        description=(
            "Max 25 MB. Allowed types: PNG, JPEG, GIF, WebP, PDF, TXT, CSV, "
            "DOC, DOCX, XLS, XLSX, ZIP, RAR."
        ),
        request=AttachmentUploadSerializer,
        responses={
            201: AttachmentSerializer,
            400: OpenApiResponse(description="File too large or unsupported type"),
        },
    ),
    retrieve=extend_schema(
        tags=["Attachments"],
        summary="Download an attachment",
        description="Returns the file as a binary download (Content-Disposition: attachment).",
        responses={(200, "application/octet-stream"): bytes},
    ),
    destroy=extend_schema(
        tags=["Attachments"],
        summary="Delete an attachment",
        description="Manager-only.",
        responses={204: None, 403: OpenApiResponse(description="Only managers can delete attachments")},
    ),
)
class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    queryset = Attachment.objects.none()

    def get_permissions(self):
        if self.action == "destroy":
            return [IsManager()]
        return [IsAuthenticated()]

    def _get_scoped_task(self):
        """Get task scoped to the requesting user's organization."""
        task_id = self.kwargs.get("task_pk")
        return get_object_or_404(
            Task.objects.filter(organization=self.request.user.organization),
            pk=task_id,
        )

    def get_queryset(self):
        task = self._get_scoped_task()
        return Attachment.objects.filter(task=task).select_related("uploaded_by")

    def create(self, request, task_pk=None):
        task = self._get_scoped_task()
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        attachment = Attachment.objects.create(
            task=task,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            file_size=uploaded_file.size,
            content_type=uploaded_file.content_type,
            uploaded_by=request.user,
        )

        create_audit_entry(
            task=task,
            actor=request.user,
            action=AuditLogEntry.Action.FILE_ATTACHED,
            field_name="attachment",
            new_value=uploaded_file.name,
        )

        return Response(
            AttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, *args, **kwargs):
        attachment = self.get_object()
        return FileResponse(
            attachment.file.open("rb"),
            content_type=attachment.content_type,
            as_attachment=True,
            filename=attachment.original_filename,
        )
