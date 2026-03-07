from rest_framework import serializers

from .models import ReportSummary


class RequestedBySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class SummaryListSerializer(serializers.ModelSerializer):
    has_versions = serializers.BooleanField(read_only=True, default=False, help_text="True if there are multiple versions (regenerations) for this period.")

    class Meta:
        model = ReportSummary
        fields = [
            "id", "period_type", "period_start", "period_end",
            "summary_text", "generation_method", "status",
            "generated_at", "has_versions",
        ]


class SummaryDetailSerializer(serializers.ModelSerializer):
    version_count = serializers.IntegerField(read_only=True, default=1, help_text="Total number of versions for this period.")
    requested_by = RequestedBySerializer(read_only=True)

    class Meta:
        model = ReportSummary
        fields = [
            "id", "period_type", "period_start", "period_end",
            "summary_text", "generation_method", "status",
            "llm_model", "prompt_tokens", "completion_tokens",
            "generation_time_ms", "raw_data", "error_message",
            "requested_by", "generated_at", "version_count",
        ]


class SummaryVersionSerializer(serializers.ModelSerializer):
    requested_by = RequestedBySerializer(read_only=True)

    class Meta:
        model = ReportSummary
        fields = [
            "id", "summary_text", "generation_method", "status",
            "generated_at", "requested_by",
        ]


class GenerateRequestSerializer(serializers.Serializer):
    period_start = serializers.DateField(help_text="Start date (YYYY-MM-DD). Must be <= period_end.")
    period_end = serializers.DateField(help_text="End date (YYYY-MM-DD). Must be >= period_start.")

    def validate(self, data):
        if data["period_end"] < data["period_start"]:
            raise serializers.ValidationError(
                {"period_end": "period_end must be >= period_start."}
            )
        return data
