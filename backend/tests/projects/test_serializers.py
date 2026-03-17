import pytest
from django.db.models import Count
from rest_framework.test import APIRequestFactory

from apps.projects.models import Project
from apps.projects.serializers import (
    EpicCreateEngineerSerializer,
    EpicCreateSerializer,
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)
from tests.factories import (
    ClientFactory,
    EngineerFactory,
    ManagerFactory,
    OrganizationFactory,
)
from tests.projects.factories import EpicFactory, ProjectFactory


def _fake_request(user):
    """Build a minimal fake request with an authenticated user."""
    factory = APIRequestFactory()
    request = factory.post("/fake/")
    request.user = user
    return request


@pytest.mark.django_db
class TestProjectListSerializer:
    def test_serializes_with_epics_count(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager)
        EpicFactory(created_by=manager, project=project, organization=manager.organization)
        EpicFactory(created_by=manager, project=project, organization=manager.organization)

        qs = Project.objects.filter(pk=project.pk).annotate(
            epics_count=Count("epics", distinct=True)
        )
        serializer = ProjectListSerializer(qs.first())
        assert serializer.data["epics_count"] == 2

    def test_fields_present(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager)
        qs = Project.objects.filter(pk=project.pk).annotate(
            epics_count=Count("epics", distinct=True)
        )
        serializer = ProjectListSerializer(qs.first())
        expected_fields = {
            "id", "title", "status", "priority", "deadline",
            "assignee", "client", "tags", "epics_count",
            "created_at", "updated_at",
        }
        assert set(serializer.data.keys()) == expected_fields

    def test_epics_count_defaults_to_zero(self):
        project = ProjectFactory()
        serializer = ProjectListSerializer(project)
        assert serializer.data["epics_count"] == 0


@pytest.mark.django_db
class TestProjectDetailSerializer:
    def test_fields_present(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager)
        qs = Project.objects.filter(pk=project.pk).annotate(
            epics_count=Count("epics", distinct=True)
        )
        serializer = ProjectDetailSerializer(qs.first())
        expected_fields = {
            "id", "title", "description", "status", "priority", "deadline",
            "assignee", "client", "tags", "created_by",
            "epics_count", "version", "created_at", "updated_at",
        }
        assert set(serializer.data.keys()) == expected_fields

    def test_created_by_nested(self):
        manager = ManagerFactory(first_name="Alice", last_name="Smith")
        project = ProjectFactory(created_by=manager)
        serializer = ProjectDetailSerializer(project)
        assert serializer.data["created_by"]["first_name"] == "Alice"
        assert serializer.data["created_by"]["last_name"] == "Smith"


@pytest.mark.django_db
class TestProjectCreateSerializer:
    def test_valid_payload_succeeds(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {
            "title": "New Project",
            "description": "A test project",
            "priority": "high",
        }
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        project = serializer.save()
        assert project.pk is not None
        assert project.title == "New Project"
        assert project.created_by == manager
        assert project.organization == manager.organization

    def test_missing_title_fails(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {"description": "No title given"}
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert not serializer.is_valid()
        assert "title" in serializer.errors

    def test_invalid_assignee_id_fails(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {"title": "Test", "assignee_id": 99999}
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert not serializer.is_valid()
        assert "assignee_id" in serializer.errors

    def test_valid_assignee_id_succeeds(self):
        manager = ManagerFactory()
        engineer = EngineerFactory(organization=manager.organization)
        request = _fake_request(manager)
        data = {"title": "With Assignee", "assignee_id": engineer.pk}
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        project = serializer.save()
        assert project.assignee == engineer

    def test_invalid_client_id_fails(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {"title": "Test", "client_id": 99999}
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert not serializer.is_valid()
        assert "client_id" in serializer.errors

    def test_valid_client_id_succeeds(self):
        manager = ManagerFactory()
        client = ClientFactory(organization=manager.organization)
        request = _fake_request(manager)
        data = {"title": "With Client", "client_id": client.pk}
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        project = serializer.save()
        assert project.client == client

    def test_null_assignee_id_allowed(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {"title": "No Assignee", "assignee_id": None}
        serializer = ProjectCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
class TestEpicCreateSerializer:
    def test_valid_payload_succeeds(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {
            "title": "New Epic",
            "description": "An epic",
            "priority": "medium",
        }
        serializer = EpicCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        epic = serializer.save()
        assert epic.pk is not None
        assert epic.title == "New Epic"
        assert epic.organization == manager.organization

    def test_project_id_must_belong_to_same_org(self):
        manager = ManagerFactory()
        other_org = OrganizationFactory()
        other_manager = ManagerFactory(organization=other_org)
        other_project = ProjectFactory(created_by=other_manager)

        request = _fake_request(manager)
        data = {"title": "Cross-org Epic", "project_id": other_project.pk}
        serializer = EpicCreateSerializer(data=data, context={"request": request})
        assert not serializer.is_valid()
        assert "project_id" in serializer.errors

    def test_valid_project_id_succeeds(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager)
        request = _fake_request(manager)
        data = {"title": "Linked Epic", "project_id": project.pk}
        serializer = EpicCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        epic = serializer.save()
        assert epic.project == project

    def test_null_project_id_creates_standalone(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {"title": "Standalone Epic", "project_id": None}
        serializer = EpicCreateSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        epic = serializer.save()
        assert epic.project is None

    def test_invalid_assignee_id_fails(self):
        manager = ManagerFactory()
        request = _fake_request(manager)
        data = {"title": "Bad Assignee", "assignee_id": 99999}
        serializer = EpicCreateSerializer(data=data, context={"request": request})
        assert not serializer.is_valid()
        assert "assignee_id" in serializer.errors


@pytest.mark.django_db
class TestEpicCreateEngineerSerializer:
    def test_valid_payload_succeeds(self):
        engineer = EngineerFactory()
        request = _fake_request(engineer)
        data = {
            "title": "Engineer Epic",
            "description": "Created by engineer",
            "priority": "low",
        }
        serializer = EpicCreateEngineerSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        epic = serializer.save()
        assert epic.pk is not None
        assert epic.created_by == engineer

    def test_no_assignee_id_field(self):
        """Engineer serializer should not accept assignee_id."""
        engineer = EngineerFactory()
        request = _fake_request(engineer)
        data = {
            "title": "Test",
            "assignee_id": engineer.pk,
        }
        serializer = EpicCreateEngineerSerializer(data=data, context={"request": request})
        # assignee_id is not a field on this serializer, so it will be ignored
        assert serializer.is_valid(), serializer.errors
        epic = serializer.save()
        assert epic.assignee is None

    def test_no_client_id_field(self):
        """Engineer serializer should not accept client_id."""
        client = ClientFactory()
        engineer = EngineerFactory()
        request = _fake_request(engineer)
        data = {
            "title": "Test",
            "client_id": client.pk,
        }
        serializer = EpicCreateEngineerSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        epic = serializer.save()
        assert epic.client is None

    def test_project_id_cross_org_fails(self):
        engineer = EngineerFactory()
        other_org = OrganizationFactory()
        other_manager = ManagerFactory(organization=other_org)
        other_project = ProjectFactory(created_by=other_manager)

        request = _fake_request(engineer)
        data = {"title": "Cross-org", "project_id": other_project.pk}
        serializer = EpicCreateEngineerSerializer(data=data, context={"request": request})
        assert not serializer.is_valid()
        assert "project_id" in serializer.errors
