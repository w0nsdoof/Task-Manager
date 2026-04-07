import pytest

from apps.comments.models import Comment
from apps.notifications.models import Notification
from tests.factories import EngineerFactory, TaskFactory


def comments_url(task_id):
    return f"/api/tasks/{task_id}/comments/"


def comment_detail_url(task_id, comment_id):
    return f"/api/tasks/{task_id}/comments/{comment_id}/"


@pytest.mark.django_db
class TestCommentCreate:
    def test_engineer_creates_comment(self, engineer_client, task):
        resp = engineer_client.post(
            comments_url(task.id),
            {"content": "A comment", "is_public": True},
            format="json",
        )
        assert resp.status_code == 201
        assert Comment.objects.filter(task=task).count() == 1

    def test_client_cannot_create_comment(self, client_user_client, task):
        resp = client_user_client.post(
            comments_url(task.id),
            {"content": "Nope", "is_public": True},
            format="json",
        )
        assert resp.status_code == 403

    def test_mention_creates_notification(self, api_client, task, manager, organization):
        eng = EngineerFactory(first_name="Alice", last_name="Smith", organization=organization)
        api_client.force_authenticate(user=manager)
        api_client.post(
            comments_url(task.id),
            {"content": "Hey @Alice Smith check this", "is_public": True},
            format="json",
        )
        assert Notification.objects.filter(
            recipient=eng, event_type="mention"
        ).exists()

    def test_comment_notifies_other_assignees(self, api_client, task, manager, organization):
        eng1 = EngineerFactory(organization=organization)
        eng2 = EngineerFactory(organization=organization)
        task.assignees.set([eng1, eng2])
        api_client.force_authenticate(user=eng1)
        api_client.post(
            comments_url(task.id),
            {"content": "Update here", "is_public": True},
            format="json",
        )
        assert Notification.objects.filter(
            recipient=eng2, event_type="comment_added"
        ).exists()
        # eng1 is the author, should not get notified
        assert not Notification.objects.filter(
            recipient=eng1, event_type="comment_added"
        ).exists()


@pytest.mark.django_db
class TestCommentVisibility:
    def test_client_sees_only_public_comments(self, client_user_client, client_user, manager):
        task = TaskFactory(created_by=manager, client=client_user.client)
        Comment.objects.create(task=task, author=manager, content="Public", is_public=True)
        Comment.objects.create(task=task, author=manager, content="Internal", is_public=False)

        resp = client_user_client.get(comments_url(task.id))
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["content"] == "Public"

    def test_manager_sees_all_comments(self, manager_client, task, manager):
        Comment.objects.create(task=task, author=manager, content="Public", is_public=True)
        Comment.objects.create(task=task, author=manager, content="Internal", is_public=False)

        resp = manager_client.get(comments_url(task.id))
        assert resp.data["count"] == 2


@pytest.mark.django_db
class TestCommentUpdate:
    def test_author_can_patch_own_comment(self, api_client, task, engineer):
        comment = Comment.objects.create(task=task, author=engineer, content="Original", is_public=True)
        api_client.force_authenticate(user=engineer)

        resp = api_client.patch(
            comment_detail_url(task.id, comment.id),
            {"content": "Edited"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["content"] == "Edited"
        comment.refresh_from_db()
        assert comment.content == "Edited"

    def test_author_can_put_own_comment(self, api_client, task, engineer):
        comment = Comment.objects.create(task=task, author=engineer, content="Original", is_public=True)
        api_client.force_authenticate(user=engineer)

        resp = api_client.put(
            comment_detail_url(task.id, comment.id),
            {"content": "Replaced", "is_public": False},
            format="json",
        )
        assert resp.status_code == 200
        comment.refresh_from_db()
        assert comment.content == "Replaced"
        assert comment.is_public is False

    def test_author_can_toggle_visibility_only(self, api_client, task, engineer):
        comment = Comment.objects.create(task=task, author=engineer, content="Keep me", is_public=True)
        api_client.force_authenticate(user=engineer)

        resp = api_client.patch(
            comment_detail_url(task.id, comment.id),
            {"is_public": False},
            format="json",
        )
        assert resp.status_code == 200
        comment.refresh_from_db()
        assert comment.content == "Keep me"
        assert comment.is_public is False

    def test_non_author_engineer_cannot_edit(self, api_client, task, engineer, engineer2):
        comment = Comment.objects.create(task=task, author=engineer, content="Mine", is_public=True)
        api_client.force_authenticate(user=engineer2)

        resp = api_client.patch(
            comment_detail_url(task.id, comment.id),
            {"content": "Hijacked"},
            format="json",
        )
        assert resp.status_code == 403
        comment.refresh_from_db()
        assert comment.content == "Mine"

    def test_manager_cannot_edit_engineers_comment(self, api_client, task, engineer, manager_client):
        comment = Comment.objects.create(task=task, author=engineer, content="Engineer note", is_public=True)

        resp = manager_client.patch(
            comment_detail_url(task.id, comment.id),
            {"content": "Manager rewrites"},
            format="json",
        )
        assert resp.status_code == 403
        comment.refresh_from_db()
        assert comment.content == "Engineer note"

    def test_client_cannot_edit_any_comment(self, task, manager, client_user_client):
        comment = Comment.objects.create(task=task, author=manager, content="Public", is_public=True)
        resp = client_user_client.patch(
            comment_detail_url(task.id, comment.id),
            {"content": "Client edit"},
            format="json",
        )
        assert resp.status_code == 403

    def test_empty_patch_rejected(self, api_client, task, engineer):
        comment = Comment.objects.create(task=task, author=engineer, content="Hi", is_public=True)
        api_client.force_authenticate(user=engineer)

        resp = api_client.patch(
            comment_detail_url(task.id, comment.id),
            {},
            format="json",
        )
        assert resp.status_code == 400

    def test_edit_reparses_mentions_and_notifies_new_user(self, api_client, task, engineer, organization):
        comment = Comment.objects.create(task=task, author=engineer, content="Plain text", is_public=True)
        target = EngineerFactory(first_name="Bob", last_name="Jones", organization=organization)
        api_client.force_authenticate(user=engineer)

        resp = api_client.patch(
            comment_detail_url(task.id, comment.id),
            {"content": "Now mentioning @Bob Jones"},
            format="json",
        )
        assert resp.status_code == 200
        assert Notification.objects.filter(
            recipient=target, event_type="mention"
        ).exists()


@pytest.mark.django_db
class TestCommentDelete:
    def test_author_can_delete_own_comment(self, api_client, task, engineer):
        comment = Comment.objects.create(task=task, author=engineer, content="Bye", is_public=True)
        api_client.force_authenticate(user=engineer)

        resp = api_client.delete(comment_detail_url(task.id, comment.id))
        assert resp.status_code == 204
        assert not Comment.objects.filter(pk=comment.pk).exists()

    def test_non_author_engineer_cannot_delete(self, api_client, task, engineer, engineer2):
        comment = Comment.objects.create(task=task, author=engineer, content="Mine", is_public=True)
        api_client.force_authenticate(user=engineer2)

        resp = api_client.delete(comment_detail_url(task.id, comment.id))
        assert resp.status_code == 403
        assert Comment.objects.filter(pk=comment.pk).exists()

    def test_manager_cannot_delete_engineers_comment(self, task, engineer, manager_client):
        comment = Comment.objects.create(task=task, author=engineer, content="Engineer note", is_public=True)

        resp = manager_client.delete(comment_detail_url(task.id, comment.id))
        assert resp.status_code == 403
        assert Comment.objects.filter(pk=comment.pk).exists()

    def test_client_cannot_delete_any_comment(self, task, manager, client_user_client):
        comment = Comment.objects.create(task=task, author=manager, content="Public", is_public=True)
        resp = client_user_client.delete(comment_detail_url(task.id, comment.id))
        assert resp.status_code == 403
        assert Comment.objects.filter(pk=comment.pk).exists()

    def test_returns_404_for_unknown_comment_in_task(self, api_client, task, engineer):
        api_client.force_authenticate(user=engineer)
        resp = api_client.delete(comment_detail_url(task.id, 999999))
        assert resp.status_code == 404

    def test_cross_task_lookup_is_404(self, api_client, manager, engineer):
        task_a = TaskFactory(created_by=manager, organization=manager.organization)
        task_b = TaskFactory(created_by=manager, organization=manager.organization)
        comment = Comment.objects.create(task=task_a, author=engineer, content="On A", is_public=True)
        api_client.force_authenticate(user=engineer)

        resp = api_client.delete(comment_detail_url(task_b.id, comment.id))
        assert resp.status_code == 404
