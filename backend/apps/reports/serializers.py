from rest_framework import serializers


class ReportPeriodSerializer(serializers.Serializer):
    start = serializers.CharField(
        source="from", allow_null=True, help_text="Start date (YYYY-MM-DD) or null if not filtered"
    )
    end = serializers.CharField(
        source="to", allow_null=True, help_text="End date (YYYY-MM-DD) or null if not filtered"
    )


class ReportStuckWaitingSerializer(serializers.Serializer):
    count = serializers.IntegerField(help_text="Total tasks stuck in waiting for 3+ days")
    sample = serializers.ListField(
        child=serializers.DictField(),
        help_text="Stuck task sample: [{id, title, priority, waiting_hours}]",
    )


class ReportDurationSerializer(serializers.Serializer):
    avg_hours = serializers.FloatField(allow_null=True)
    median_hours = serializers.FloatField(allow_null=True)
    p90_hours = serializers.FloatField(allow_null=True)
    count = serializers.IntegerField()


class ReportTasksSerializer(serializers.Serializer):
    total = serializers.IntegerField(help_text="Total tasks in organization")
    by_status = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Task count per status: {created, in_progress, waiting, done, archived}",
    )
    by_priority = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Task count per priority: {low, medium, high, critical}",
    )
    created_in_period = serializers.IntegerField(help_text="Tasks created during the filtered period")
    closed_in_period = serializers.IntegerField(help_text="Tasks completed during the period (via audit log)")
    overdue = serializers.IntegerField(help_text="Active tasks past their deadline")
    avg_resolution_time_hours = serializers.FloatField(
        allow_null=True, help_text="Average lead time hours (created -> done) for tasks closed in period"
    )
    unassigned_count = serializers.IntegerField(help_text="Active tasks with no assignees")
    stuck_waiting = ReportStuckWaitingSerializer(help_text="Tasks stuck in waiting status for 3+ days")
    completion_rate = serializers.FloatField(
        allow_null=True, help_text="Percentage of created tasks that were completed in the period"
    )
    lead_time = ReportDurationSerializer(help_text="Created -> done duration distribution (hours)")
    cycle_time = ReportDurationSerializer(help_text="In-progress -> done duration distribution (hours)")


class ReportByClientSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    total = serializers.IntegerField(help_text="Tasks for this client created in the period")
    done = serializers.IntegerField(help_text="Tasks for this client currently in 'done' status")


class ReportByEngineerSerializer(serializers.Serializer):
    engineer_id = serializers.IntegerField()
    engineer_name = serializers.CharField()
    assigned = serializers.IntegerField()
    done = serializers.IntegerField()


class ReportByTagSerializer(serializers.Serializer):
    tag_id = serializers.IntegerField()
    tag_name = serializers.CharField()
    count = serializers.IntegerField(help_text="Number of tasks with this tag")


class ReportSummaryResponseSerializer(serializers.Serializer):
    period = ReportPeriodSerializer()
    tasks = ReportTasksSerializer()
    by_client = ReportByClientSerializer(many=True)
    by_engineer = ReportByEngineerSerializer(many=True)
    by_tag = ReportByTagSerializer(many=True, help_text="Task count per tag")
