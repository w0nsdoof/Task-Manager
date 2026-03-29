"""Unit tests for telegram notification templates."""

import pytest

from apps.telegram.templates import (
    HEADINGS,
    build_telegram_context,
    render_telegram_message,
)

# ── render_telegram_message tests ─────────────────────────────────────


class TestRenderTelegramMessage:
    def test_status_changed_en(self):
        ctx = {
            "event_type": "status_changed",
            "entity_type": "task",
            "title": "Fix login bug",
            "old_status": "created",
            "new_status": "in_progress",
            "actor": "John Doe",
            "task_id": 42,
        }
        result = render_telegram_message("status_changed", "en", ctx)

        assert "Task status changed" in result
        assert "Type: Task" in result
        assert "Title: Fix login bug" in result
        assert "Previous status: Created" in result
        assert "New status: In Progress" in result
        assert "By: John Doe" in result
        assert "/tasks/42" in result

    def test_status_changed_ru(self):
        ctx = {
            "event_type": "status_changed",
            "entity_type": "task",
            "title": "Fix login bug",
            "old_status": "created",
            "new_status": "in_progress",
            "actor": "John Doe",
            "task_id": 42,
        }
        result = render_telegram_message("status_changed", "ru", ctx)

        assert "\u0418\u0437\u043c\u0435\u043d\u0451\u043d \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u0434\u0430\u0447\u0438" in result  # Изменён статус задачи
        assert "\u0422\u0438\u043f: \u0417\u0430\u0434\u0430\u0447\u0430" in result  # Тип: Задача
        assert "\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0438\u0439 \u0441\u0442\u0430\u0442\u0443\u0441: \u0421\u043e\u0437\u0434\u0430\u043d\u043e" in result  # Предыдущий статус: Создано
        assert "\u041d\u043e\u0432\u044b\u0439 \u0441\u0442\u0430\u0442\u0443\u0441: \u0412 \u0440\u0430\u0431\u043e\u0442\u0435" in result  # Новый статус: В работе
        assert "\u041e\u0442\u043a\u0440\u044b\u0442\u044c" in result  # Открыть (link text)

    def test_task_assigned_en(self):
        ctx = {
            "event_type": "task_assigned",
            "entity_type": "subtask",
            "title": "Write unit tests",
            "assignee": "Jane Smith",
            "priority": "high",
            "deadline": "15.04.2026",
            "actor": "John Doe",
            "task_id": 10,
        }
        result = render_telegram_message("task_assigned", "en", ctx)

        assert "New task assignment" in result
        assert "Type: Subtask" in result
        assert "Priority: High" in result
        assert "Deadline: 15.04.2026" in result
        assert "Assignee: Jane Smith" in result

    def test_comment_added_en(self):
        ctx = {
            "event_type": "comment_added",
            "entity_type": "task",
            "title": "Backend dev",
            "comment_author": "Alice",
            "task_id": 5,
        }
        result = render_telegram_message("comment_added", "en", ctx)

        assert "New comment" in result
        assert "Comment by: Alice" in result
        assert "Title: Backend dev" in result

    def test_mention_ru(self):
        ctx = {
            "event_type": "mention",
            "entity_type": "task",
            "title": "API design",
            "comment_author": "Bob",
            "task_id": 7,
        }
        result = render_telegram_message("mention", "ru", ctx)

        assert "\u0412\u0430\u0441 \u0443\u043f\u043e\u043c\u044f\u043d\u0443\u043b\u0438" in result  # Вас упомянули
        assert "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043e\u0442: Bob" in result  # Комментарий от

    def test_deadline_warning_en(self):
        ctx = {
            "event_type": "deadline_warning",
            "entity_type": "task",
            "title": "Deploy hotfix",
            "assignee": "Team Lead",
            "priority": "critical",
            "deadline": "30.03.2026",
            "task_id": 99,
        }
        result = render_telegram_message("deadline_warning", "en", ctx)

        assert "Deadline approaching" in result
        assert "Priority: Critical" in result
        assert "Deadline: 30.03.2026" in result

    def test_project_assigned_en(self):
        ctx = {
            "event_type": "project_assigned",
            "entity_type": "project",
            "title": "Q2 Roadmap",
            "priority": "high",
            "deadline": "01.07.2026",
            "actor": "CTO",
            "project_id": 3,
        }
        result = render_telegram_message("project_assigned", "en", ctx)

        assert "New project assignment" in result
        assert "Type: Project" in result

    def test_epic_assigned_ru(self):
        ctx = {
            "event_type": "epic_assigned",
            "entity_type": "epic",
            "title": "Auth Rewrite",
            "actor": "PM",
            "epic_id": 5,
        }
        result = render_telegram_message("epic_assigned", "ru", ctx)

        assert "\u041d\u043e\u0432\u043e\u0435 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u044d\u043f\u0438\u043a\u0430" in result  # Новое назначение эпика
        assert "\u0422\u0438\u043f: \u042d\u043f\u0438\u043a" in result  # Тип: Эпик

    def test_summary_ready_en(self):
        ctx = {
            "event_type": "summary_ready",
            "entity_type": "summary",
            "title": "Weekly summary",
            "period": "2026-03-22 to 2026-03-28",
        }
        result = render_telegram_message("summary_ready", "en", ctx)

        assert "Report summary ready" in result
        assert "Title: Weekly summary" in result
        assert "Period: 2026-03-22 to 2026-03-28" in result

    def test_missing_optional_fields_are_omitted(self):
        ctx = {
            "event_type": "task_assigned",
            "entity_type": "task",
            "title": "Minimal task",
            "task_id": 1,
        }
        result = render_telegram_message("task_assigned", "en", ctx)

        assert "Title: Minimal task" in result
        # These fields are absent in context, so should not appear
        assert "Priority:" not in result
        assert "Deadline:" not in result
        assert "Assignee:" not in result

    def test_html_escaping(self):
        ctx = {
            "event_type": "task_assigned",
            "entity_type": "task",
            "title": "Fix <script>alert('xss')</script>",
            "actor": "Hacker & Co",
            "task_id": 1,
        }
        result = render_telegram_message("task_assigned", "en", ctx)

        assert "&lt;script&gt;" in result
        assert "&amp; Co" in result
        assert "<script>" not in result

    def test_long_title_truncation(self):
        long_title = "A" * 300
        ctx = {
            "event_type": "task_assigned",
            "entity_type": "task",
            "title": long_title,
            "task_id": 1,
        }
        result = render_telegram_message("task_assigned", "en", ctx)

        # 200 chars + ellipsis
        assert "A" * 200 + "\u2026" in result
        assert "A" * 201 not in result

    def test_unknown_language_falls_back_to_en(self):
        ctx = {
            "event_type": "task_assigned",
            "entity_type": "task",
            "title": "Test",
            "task_id": 1,
        }
        result = render_telegram_message("task_assigned", "kz", ctx)

        assert "New task assignment" in result  # English heading

    def test_unknown_event_type_graceful_fallback(self):
        ctx = {
            "event_type": "some_new_event",
            "title": "Test",
        }
        result = render_telegram_message("some_new_event", "en", ctx)

        # Should not crash, uses fallback emoji and title-cased event name
        assert "Some New Event" in result
        assert "Title: Test" in result

    def test_all_event_types_have_both_languages(self):
        for event_type, heading_map in HEADINGS.items():
            assert "en" in heading_map, f"{event_type} missing 'en' heading"
            assert "ru" in heading_map, f"{event_type} missing 'ru' heading"

    def test_entity_url_for_epic(self):
        ctx = {
            "event_type": "epic_assigned",
            "entity_type": "epic",
            "title": "Test Epic",
            "epic_id": 42,
        }
        result = render_telegram_message("epic_assigned", "en", ctx)
        assert "epic=42" in result

    def test_entity_url_for_project(self):
        ctx = {
            "event_type": "project_assigned",
            "entity_type": "project",
            "title": "Test Project",
            "project_id": 7,
        }
        result = render_telegram_message("project_assigned", "en", ctx)
        assert "project=7" in result


# ── build_telegram_context tests ──────────────────────────────────────


@pytest.mark.django_db
class TestBuildTelegramContext:
    def test_task_context(self, task, engineer):
        task.assignees.add(engineer)
        ctx = build_telegram_context(event_type="task_assigned", task=task, actor=task.created_by)

        assert ctx["event_type"] == "task_assigned"
        assert ctx["entity_type"] == "task"
        assert ctx["title"] == task.title
        assert ctx["priority"] == task.priority
        assert ctx["task_id"] == task.pk
        assert engineer.first_name in ctx["assignee"]
        assert task.created_by.first_name in ctx["actor"]

    def test_subtask_context(self, task, manager):
        from apps.tasks.models import Task

        subtask = Task.objects.create(
            title="Child task",
            parent_task=task,
            created_by=manager,
            organization=manager.organization,
        )
        ctx = build_telegram_context(event_type="task_assigned", task=subtask)

        assert ctx["entity_type"] == "subtask"

    def test_project_context(self, manager):
        from apps.projects.models import Project

        project = Project.objects.create(
            title="Test Project",
            priority="high",
            assignee=manager,
            created_by=manager,
            organization=manager.organization,
        )
        ctx = build_telegram_context(event_type="project_assigned", project=project, actor=manager)

        assert ctx["entity_type"] == "project"
        assert ctx["title"] == "Test Project"
        assert ctx["priority"] == "high"
        assert ctx["project_id"] == project.pk
        assert manager.first_name in ctx["assignee"]
        assert manager.first_name in ctx["actor"]

    def test_epic_context(self, manager):
        from apps.projects.models import Epic

        epic = Epic.objects.create(
            title="Test Epic",
            priority="medium",
            assignee=manager,
            created_by=manager,
            organization=manager.organization,
        )
        ctx = build_telegram_context(event_type="epic_assigned", epic=epic, actor=manager)

        assert ctx["entity_type"] == "epic"
        assert ctx["title"] == "Test Epic"
        assert ctx["epic_id"] == epic.pk

    def test_extra_fields_merged(self, task):
        ctx = build_telegram_context(
            event_type="status_changed",
            task=task,
            extra={"old_status": "created", "new_status": "in_progress"},
        )

        assert ctx["old_status"] == "created"
        assert ctx["new_status"] == "in_progress"

    def test_no_actor_omitted(self, task):
        ctx = build_telegram_context(event_type="deadline_warning", task=task)

        assert "actor" not in ctx

    def test_deadline_formatted(self, task):
        ctx = build_telegram_context(event_type="task_assigned", task=task)

        # deadline is set in TaskFactory, should be DD.MM.YYYY format
        assert ctx["deadline"] is not None
        parts = ctx["deadline"].split(".")
        assert len(parts) == 3  # DD.MM.YYYY

    def test_task_without_assignees(self, task):
        ctx = build_telegram_context(event_type="task_assigned", task=task)

        assert ctx["assignee"] is None

    def test_all_values_are_serializable(self, task, engineer):
        """All values must be JSON-serializable for Celery."""
        import json

        task.assignees.add(engineer)
        ctx = build_telegram_context(
            event_type="status_changed",
            task=task,
            actor=task.created_by,
            extra={"old_status": "created", "new_status": "in_progress"},
        )

        # Should not raise
        json.dumps(ctx)
