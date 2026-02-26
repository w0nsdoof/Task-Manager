import logging

from celery import shared_task
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def auto_archive_done_tasks():
    """Archive tasks that are done and past their deadline."""
    from apps.tasks.models import Task

    now = timezone.now()
    tasks = Task.objects.filter(status=Task.Status.DONE, deadline__lt=now)
    count = tasks.update(status=Task.Status.ARCHIVED, version=F("version") + 1)
    if count:
        logger.info("Auto-archived %d done tasks with expired deadlines", count)
    return count
