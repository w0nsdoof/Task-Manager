from apps.notifications.models import Notification


def create_notification(recipient, event_type, task=None, message="", related_object_id=None, actor=None, project=None, epic=None):
    notification = Notification.objects.create(
        recipient=recipient,
        event_type=event_type,
        task=task,
        project=project,
        epic=epic,
        message=message,
        related_object_id=related_object_id,
    )

    # Dispatch Telegram notification (skip if recipient is the actor — FR-008)
    if actor is None or recipient.pk != actor.pk:
        from apps.telegram.tasks import send_telegram_notification

        title = None
        if task:
            title = task.title
        elif project:
            title = project.title
        elif epic:
            title = epic.title
        send_telegram_notification.delay(recipient.pk, message, title)

    return notification
