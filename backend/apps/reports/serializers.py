from rest_framework import serializers


class ReportPeriodSerializer(serializers.Serializer):
    start = serializers.CharField(
        source="from", allow_null=True, help_text="Start date (YYYY-MM-DD) or null if not filtered"
    )
    end = serializers.CharField(
        source="to", allow_null=True, help_text="End date (YYYY-MM-DD) or null if not filtered"
    )


class ReportTasksSerializer(serializers.Serializer):
    total = serializers.IntegerField(help_text="Total tasks matching filters")
    by_status = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Task count per status: {created, in_progress, waiting, done, archived}",
    )
    by_priority = serializers.DictField(
        child=serializers.IntegerField(),
        help_text="Task count per priority: {low, medium, high, critical}",
    )
    created_in_period = serializers.IntegerField(help_text="Tasks created in the filtered period")
    closed_in_period = serializers.IntegerField(help_text="Tasks with status=done in the period")
    overdue = serializers.IntegerField(help_text="Active tasks past their deadline")


class ReportByClientSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    total = serializers.IntegerField()
    created = serializers.IntegerField()
    done = serializers.IntegerField()


class ReportByEngineerSerializer(serializers.Serializer):
    engineer_id = serializers.IntegerField()
    engineer_name = serializers.CharField()
    assigned = serializers.IntegerField()
    done = serializers.IntegerField()


class ReportSummaryResponseSerializer(serializers.Serializer):
    period = ReportPeriodSerializer()
    tasks = ReportTasksSerializer()
    by_client = ReportByClientSerializer(many=True)
    by_engineer = ReportByEngineerSerializer(many=True)
