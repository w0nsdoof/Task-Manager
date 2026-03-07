from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    queryset = Notification.objects.none()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        qs = Notification.objects.filter(recipient=self.request.user).select_related("task")
        is_read = self.request.query_params.get("is_read")
        if is_read is not None:
            qs = qs.filter(is_read=is_read.lower() == "true")
        return qs

    @extend_schema(
        tags=["Notifications"],
        summary="List notifications",
        description="Paginated list of notifications for the current user, newest first.",
        parameters=[
            OpenApiParameter("is_read", type=bool, description="Filter: true=read only, false=unread only"),
        ],
    )
    def list(self, request):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Notifications"],
        summary="Mark notification as read",
        request=None,
        responses={
            200: inline_serializer("MarkReadResponse", fields={
                "id": serializers.IntegerField(),
                "is_read": serializers.BooleanField(),
            }),
            404: OpenApiResponse(description="Notification not found"),
        },
    )
    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"id": notif.id, "is_read": True})

    @extend_schema(
        tags=["Notifications"],
        summary="Mark all notifications as read",
        request=None,
        responses={200: inline_serializer("MarkAllReadResponse", fields={
            "updated_count": serializers.IntegerField(help_text="Number of notifications marked as read"),
        })},
    )
    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"updated_count": count})
