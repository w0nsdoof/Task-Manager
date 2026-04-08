from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.attachments.serializers import AttachmentSerializer
from apps.comments.models import Comment

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "role"]


class MentionSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "last_name"]


class CommentSerializer(serializers.ModelSerializer):
    author = CommentAuthorSerializer(read_only=True)
    mentions = MentionSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "author",
            "content",
            "is_public",
            "mentions",
            "attachments",
            "created_at",
        ]
        read_only_fields = ["id", "author", "mentions", "attachments", "created_at"]


class CommentCreateSerializer(serializers.Serializer):
    content = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text=(
            "Comment text. Use @FirstName LastName to mention users. "
            "Optional when at least one file is attached."
        ),
    )
    is_public = serializers.BooleanField(
        default=True,
        help_text="If true, visible to client-role users.",
    )
    files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        help_text="Optional file attachments. Max 25 MB each. Same MIME whitelist as task attachments.",
    )


class CommentUpdateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, required=False, help_text="Updated comment text.")
    is_public = serializers.BooleanField(required=False, help_text="If true, visible to client-role users.")

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one of 'content' or 'is_public' must be provided.")
        return attrs
