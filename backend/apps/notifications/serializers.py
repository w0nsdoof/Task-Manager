from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="event_type", help_text="Event type: task_assigned, task_unassigned, mention, comment_added, status_changed, deadline_warning, summary_ready, project_assigned, epic_assigned.")
    task_id = serializers.SerializerMethodField(help_text="Related task ID, if applicable.")
    summary_id = serializers.SerializerMethodField(help_text="Related summary ID for summary_ready events.")
    project_id = serializers.SerializerMethodField(help_text="Related project ID, if applicable.")
    epic_id = serializers.SerializerMethodField(help_text="Related epic ID, if applicable.")

    class Meta:
        model = Notification
        fields = ["id", "type", "message", "is_read", "task_id", "summary_id", "project_id", "epic_id", "created_at"]

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_task_id(self, obj):
        return obj.task_id if obj.task_id else None

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_summary_id(self, obj):
        if obj.event_type == Notification.EventType.SUMMARY_READY:
            return obj.related_object_id
        return None

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_project_id(self, obj):
        return obj.project_id if obj.project_id else None

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_epic_id(self, obj):
        return obj.epic_id if obj.epic_id else None
