"""Bilingual (en/ru) Telegram notification templates.

Provides structured, emoji-headed messages that match the spec format.
Each event type has its own heading, emoji, and set of metadata fields.
"""

from html import escape

from django.conf import settings

# ── Emoji per event type ──────────────────────────────────────────────

EMOJI = {
    "task_assigned": "\U0001f195",       # 🆕
    "task_unassigned": "\U0001f6ab",     # 🚫
    "status_changed": "\U0001f504",      # 🔄
    "task_completed": "\u2705",          # ✅
    "comment_added": "\U0001f4ac",       # 💬
    "mention": "\U0001f4e2",             # 📢
    "deadline_warning": "\u26a0\ufe0f",  # ⚠️
    "project_assigned": "\U0001f4c1",    # 📁
    "epic_assigned": "\U0001f3af",       # 🎯
    "summary_ready": "\U0001f4ca",       # 📊
}

# ── Bilingual headings ────────────────────────────────────────────────

HEADINGS = {
    "task_assigned": {
        "en": "New task assignment",
        "ru": "Новое назначение задачи",
    },
    "task_unassigned": {
        "en": "Removed from task",
        "ru": "Снято назначение задачи",
    },
    "status_changed": {
        "en": "Task status changed",
        "ru": "Изменён статус задачи",
    },
    "task_completed": {
        "en": "Task completed",
        "ru": "Задача завершена",
    },
    "comment_added": {
        "en": "New comment",
        "ru": "Новый комментарий",
    },
    "mention": {
        "en": "You were mentioned",
        "ru": "Вас упомянули",
    },
    "deadline_warning": {
        "en": "Deadline approaching",
        "ru": "Приближается дедлайн",
    },
    "project_assigned": {
        "en": "New project assignment",
        "ru": "Новое назначение проекта",
    },
    "epic_assigned": {
        "en": "New epic assignment",
        "ru": "Новое назначение эпика",
    },
    "summary_ready": {
        "en": "Report summary ready",
        "ru": "Сводка отчёта готова",
    },
}

# ── Field labels ──────────────────────────────────────────────────────

LABELS = {
    "entity_type": {"en": "Type", "ru": "Тип"},
    "title": {"en": "Title", "ru": "Название"},
    "assignee": {"en": "Assignee", "ru": "Исполнитель"},
    "priority": {"en": "Priority", "ru": "Приоритет"},
    "deadline": {"en": "Deadline", "ru": "Дедлайн"},
    "actor": {"en": "By", "ru": "Автор"},
    "old_status": {"en": "Previous status", "ru": "Предыдущий статус"},
    "new_status": {"en": "New status", "ru": "Новый статус"},
    "comment_author": {"en": "Comment by", "ru": "Комментарий от"},
    "period": {"en": "Period", "ru": "Период"},
}

# ── Value translations ────────────────────────────────────────────────

PRIORITY_DISPLAY = {
    "low": {"en": "Low", "ru": "Низкий"},
    "medium": {"en": "Medium", "ru": "Средний"},
    "high": {"en": "High", "ru": "Высокий"},
    "critical": {"en": "Critical", "ru": "Критичный"},
}

STATUS_DISPLAY = {
    "created": {"en": "Created", "ru": "Создано"},
    "in_progress": {"en": "In Progress", "ru": "В работе"},
    "waiting": {"en": "Waiting", "ru": "Ожидание"},
    "done": {"en": "Done", "ru": "Выполнено"},
    "archived": {"en": "Archived", "ru": "Архивировано"},
}

ENTITY_TYPE_DISPLAY = {
    "project": {"en": "Project", "ru": "Проект"},
    "epic": {"en": "Epic", "ru": "Эпик"},
    "task": {"en": "Task", "ru": "Задача"},
    "subtask": {"en": "Subtask", "ru": "Подзадача"},
    "summary": {"en": "Summary", "ru": "Сводка"},
}

# ── Which fields to show per event type (in order) ────────────────────

EVENT_FIELDS = {
    "task_assigned": ["entity_type", "title", "assignee", "priority", "deadline", "actor"],
    "task_unassigned": ["entity_type", "title", "actor"],
    "status_changed": ["entity_type", "title", "old_status", "new_status", "actor"],
    "task_completed": ["entity_type", "title", "assignee", "actor"],
    "comment_added": ["entity_type", "title", "comment_author"],
    "mention": ["entity_type", "title", "comment_author"],
    "deadline_warning": ["entity_type", "title", "assignee", "priority", "deadline"],
    "project_assigned": ["entity_type", "title", "priority", "deadline", "actor"],
    "epic_assigned": ["entity_type", "title", "priority", "deadline", "actor"],
    "summary_ready": ["title", "period"],
}

# ── Max title length to stay within Telegram's 4096 char limit ────────

_MAX_TITLE_LEN = 200


def _translate_value(field: str, value: str | None, lang: str) -> str:
    """Translate a field value to the target language if a mapping exists."""
    if value is None:
        return ""
    lookup = {
        "priority": PRIORITY_DISPLAY,
        "old_status": STATUS_DISPLAY,
        "new_status": STATUS_DISPLAY,
        "entity_type": ENTITY_TYPE_DISPLAY,
    }
    mapping = lookup.get(field)
    if mapping and value in mapping:
        return mapping[value].get(lang, value)
    return value


def _build_entity_url(context: dict) -> str | None:
    """Build a clickable URL for the entity, if an ID is present."""
    host = settings.ALLOWED_HOSTS[0] if settings.ALLOWED_HOSTS else "localhost"
    scheme = "http" if host == "localhost" else "https"

    if context.get("task_id"):
        return f"{scheme}://{host}/tasks/{context['task_id']}"
    if context.get("epic_id"):
        return f"{scheme}://{host}/projects?epic={context['epic_id']}"
    if context.get("project_id"):
        return f"{scheme}://{host}/projects?project={context['project_id']}"
    return None


def render_telegram_message(event_type: str, language: str, context: dict) -> str:
    """Render a structured HTML Telegram message.

    Args:
        event_type: The notification event type (e.g. "status_changed").
        language: User language code ("en" or "ru").
        context: Dict with keys like title, entity_type, priority, etc.

    Returns:
        HTML-formatted string for Telegram's parse_mode=HTML.
    """
    lang = language if language in ("en", "ru") else "en"

    emoji = EMOJI.get(event_type, "\U0001f514")  # 🔔 fallback
    heading_map = HEADINGS.get(event_type, {})
    heading = heading_map.get(lang, event_type.replace("_", " ").title())

    lines: list[str] = [f"{emoji} <b>{escape(heading)}</b>", ""]

    fields = EVENT_FIELDS.get(event_type, ["title"])
    for field in fields:
        raw_value = context.get(field)
        if raw_value is None or raw_value == "":
            continue

        label_map = LABELS.get(field)
        label = label_map.get(lang, field) if label_map else field
        display_value = _translate_value(field, str(raw_value), lang)

        # Truncate long titles
        if field == "title" and len(display_value) > _MAX_TITLE_LEN:
            display_value = display_value[:_MAX_TITLE_LEN] + "…"

        lines.append(f"{escape(label)}: {escape(display_value)}")

    url = _build_entity_url(context)
    if url:
        link_text = {"en": "View", "ru": "Открыть"}.get(lang, "View")
        lines.append(f'\n<a href="{url}">{link_text}</a>')

    return "\n".join(lines)


def build_telegram_context(
    *,
    event_type: str,
    task=None,
    project=None,
    epic=None,
    actor=None,
    extra: dict | None = None,
) -> dict:
    """Build a JSON-serializable context dict from domain objects.

    All values are primitive types (str/int/None) safe for Celery args.
    """
    ctx: dict = {"event_type": event_type}

    if task:
        ctx["entity_type"] = task.entity_type  # "task" or "subtask"
        ctx["title"] = task.title
        ctx["priority"] = task.priority or None
        ctx["deadline"] = task.deadline.strftime("%d.%m.%Y") if task.deadline else None
        ctx["task_id"] = task.pk
        assignee_names = [
            f"{a.first_name} {a.last_name}" for a in task.assignees.all()
        ]
        ctx["assignee"] = ", ".join(assignee_names) if assignee_names else None
    elif epic:
        ctx["entity_type"] = "epic"
        ctx["title"] = epic.title
        ctx["priority"] = epic.priority or None
        ctx["deadline"] = epic.deadline.strftime("%d.%m.%Y") if epic.deadline else None
        ctx["epic_id"] = epic.pk
        if epic.assignee:
            ctx["assignee"] = f"{epic.assignee.first_name} {epic.assignee.last_name}"
    elif project:
        ctx["entity_type"] = "project"
        ctx["title"] = project.title
        ctx["priority"] = project.priority or None
        ctx["deadline"] = project.deadline.strftime("%d.%m.%Y") if project.deadline else None
        ctx["project_id"] = project.pk
        if project.assignee:
            ctx["assignee"] = f"{project.assignee.first_name} {project.assignee.last_name}"

    if actor:
        ctx["actor"] = f"{actor.first_name} {actor.last_name}"

    if extra:
        ctx.update(extra)

    return ctx
