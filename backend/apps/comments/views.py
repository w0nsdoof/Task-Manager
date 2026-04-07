from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLogEntry
from apps.audit.services import create_audit_entry
from apps.comments.models import Comment
from apps.comments.serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    CommentUpdateSerializer,
)
from apps.comments.services import parse_mentions
from apps.notifications.services import create_notification
from apps.tasks.models import Task


@extend_schema_view(
    list=extend_schema(
        tags=["Comments"],
        summary="List comments for a task",
        description="Client-role users see only is_public=True comments. Includes author and mentions.",
    ),
    create=extend_schema(
        tags=["Comments"],
        summary="Add a comment to a task",
        description=(
            "Use @FirstName LastName to mention users (they will be notified). "
            "Clients cannot create comments (403)."
        ),
        request=CommentCreateSerializer,
        responses={
            201: CommentSerializer,
            403: OpenApiResponse(description="Clients cannot create comments"),
        },
    ),
    partial_update=extend_schema(
        tags=["Comments"],
        summary="Edit a comment",
        description=(
            "Only the comment author may edit their own comment. "
            "Editing re-parses @mentions and notifies any newly mentioned users."
        ),
        request=CommentUpdateSerializer,
        responses={
            200: CommentSerializer,
            403: OpenApiResponse(description="Only the author may edit this comment"),
            404: OpenApiResponse(description="Comment not found in this task"),
        },
    ),
    update=extend_schema(
        tags=["Comments"],
        summary="Replace a comment (author only)",
        request=CommentUpdateSerializer,
        responses={
            200: CommentSerializer,
            403: OpenApiResponse(description="Only the author may edit this comment"),
        },
    ),
    destroy=extend_schema(
        tags=["Comments"],
        summary="Delete a comment",
        description="Only the comment author may delete their own comment.",
        responses={
            204: OpenApiResponse(description="Deleted"),
            403: OpenApiResponse(description="Only the author may delete this comment"),
            404: OpenApiResponse(description="Comment not found in this task"),
        },
    ),
)
class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    queryset = Comment.objects.none()

    def _get_scoped_task(self):
        """Get task scoped to the requesting user's organization."""
        task_id = self.kwargs.get("task_pk")
        return get_object_or_404(
            Task.objects.filter(organization=self.request.user.organization),
            pk=task_id,
        )

    def get_queryset(self):
        task = self._get_scoped_task()
        qs = Comment.objects.filter(task=task).select_related("author").prefetch_related("mentions")
        user = self.request.user
        if user.role == "client":
            qs = qs.filter(is_public=True)
        return qs

    def _get_owned_comment(self, request, task, pk):
        """Fetch comment in this task and assert the requester is the author."""
        comment = get_object_or_404(Comment, pk=pk, task=task)
        if comment.author_id != request.user.pk:
            return None, Response(
                {"detail": "Only the comment author may modify this comment."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return comment, None

    def create(self, request, task_pk=None):
        if request.user.role == "client":
            return Response(
                {"detail": "Clients cannot create comments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        task = self._get_scoped_task()
        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = Comment.objects.create(
            task=task,
            author=request.user,
            content=serializer.validated_data["content"],
            is_public=serializer.validated_data["is_public"],
        )

        from apps.telegram.templates import build_telegram_context

        actor_name = f"{request.user.first_name} {request.user.last_name}"
        mentioned_users = parse_mentions(comment.content, organization=request.user.organization)
        if mentioned_users:
            comment.mentions.set(mentioned_users)
            for user in mentioned_users:
                ctx = build_telegram_context(
                    event_type="mention", task=task, actor=request.user,
                    extra={"comment_author": actor_name, "comment_text": comment.content},
                )
                create_notification(
                    recipient=user,
                    event_type="mention",
                    task=task,
                    message=f"{actor_name} mentioned you in a comment on task '{task.title}'",
                    actor=request.user,
                    telegram_context=ctx,
                )

        create_audit_entry(
            task=task,
            actor=request.user,
            action=AuditLogEntry.Action.COMMENT_ADDED,
            field_name="comment",
            new_value=comment.content[:200],
        )

        for assignee in task.assignees.exclude(pk=request.user.pk):
            if assignee not in mentioned_users:
                ctx = build_telegram_context(
                    event_type="comment_added", task=task, actor=request.user,
                    extra={"comment_author": actor_name, "comment_text": comment.content},
                )
                create_notification(
                    recipient=assignee,
                    event_type="comment_added",
                    task=task,
                    message=f"New comment on task '{task.title}' by {actor_name}",
                    actor=request.user,
                    telegram_context=ctx,
                )

        return Response(
            CommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, task_pk=None, pk=None):
        return self._do_update(request, pk, partial=False)

    def partial_update(self, request, task_pk=None, pk=None):
        return self._do_update(request, pk, partial=True)

    def _do_update(self, request, pk, *, partial):
        task = self._get_scoped_task()
        comment, forbidden = self._get_owned_comment(request, task, pk)
        if forbidden:
            return forbidden

        serializer = CommentUpdateSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        content_changed = "content" in validated and validated["content"] != comment.content
        if "content" in validated:
            comment.content = validated["content"]
        if "is_public" in validated:
            comment.is_public = validated["is_public"]
        comment.save(update_fields=["content", "is_public"])

        if content_changed:
            from apps.telegram.templates import build_telegram_context

            actor_name = f"{request.user.first_name} {request.user.last_name}"
            previous_mention_ids = set(comment.mentions.values_list("pk", flat=True))
            mentioned_users = parse_mentions(comment.content, organization=request.user.organization)
            comment.mentions.set(mentioned_users)
            new_mentions = [u for u in mentioned_users if u.pk not in previous_mention_ids]
            for user in new_mentions:
                ctx = build_telegram_context(
                    event_type="mention", task=task, actor=request.user,
                    extra={"comment_author": actor_name, "comment_text": comment.content},
                )
                create_notification(
                    recipient=user,
                    event_type="mention",
                    task=task,
                    message=f"{actor_name} mentioned you in a comment on task '{task.title}'",
                    actor=request.user,
                    telegram_context=ctx,
                )

        return Response(CommentSerializer(comment).data)

    def destroy(self, request, task_pk=None, pk=None):
        task = self._get_scoped_task()
        comment, forbidden = self._get_owned_comment(request, task, pk)
        if forbidden:
            return forbidden

        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
