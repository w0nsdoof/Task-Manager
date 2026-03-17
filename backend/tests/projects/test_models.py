import pytest

from apps.projects.models import Epic, Project
from tests.factories import ManagerFactory, TaskFactory
from tests.projects.factories import EpicFactory, ProjectFactory


@pytest.mark.django_db
class TestProjectModel:
    def test_create_project(self):
        project = ProjectFactory(title="Website Redesign")
        assert project.pk is not None
        assert project.title == "Website Redesign"
        assert project.status == Project.Status.CREATED
        assert project.version == 1

    def test_str_representation(self):
        project = ProjectFactory(title="My Project")
        assert str(project) == "My Project"

    def test_default_status_is_created(self):
        project = ProjectFactory()
        assert project.status == Project.Status.CREATED

    def test_status_choices(self):
        values = {c[0] for c in Project.Status.choices}
        assert values == {"created", "in_progress", "waiting", "done", "archived"}

    def test_priority_choices(self):
        values = {c[0] for c in Project.Priority.choices}
        assert values == {"low", "medium", "high", "critical"}

    def test_project_priority_nullable(self):
        project = ProjectFactory(priority=None)
        assert project.priority is None

    def test_project_ordering(self):
        manager = ManagerFactory()
        ProjectFactory(title="First", created_by=manager)
        ProjectFactory(title="Second", created_by=manager)
        projects = list(
            Project.objects.filter(organization=manager.organization).values_list(
                "title", flat=True
            )
        )
        # ordering is -created_at, so newest first
        assert projects == ["Second", "First"]

    def test_assignee_relationship(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager, assignee=manager)
        assert project.assignee == manager
        assert project in manager.assigned_projects.all()

    def test_organization_relationship(self):
        project = ProjectFactory()
        assert project.organization == project.created_by.organization


@pytest.mark.django_db
class TestEpicModel:
    def test_create_epic(self):
        epic = EpicFactory(title="Auth Module")
        assert epic.pk is not None
        assert epic.title == "Auth Module"
        assert epic.status == Epic.Status.CREATED
        assert epic.version == 1

    def test_str_representation(self):
        epic = EpicFactory(title="My Epic")
        assert str(epic) == "My Epic"

    def test_default_status_is_created(self):
        epic = EpicFactory()
        assert epic.status == Epic.Status.CREATED

    def test_status_choices(self):
        values = {c[0] for c in Epic.Status.choices}
        assert values == {"created", "in_progress", "waiting", "done", "archived"}

    def test_priority_choices(self):
        values = {c[0] for c in Epic.Priority.choices}
        assert values == {"low", "medium", "high", "critical"}

    def test_epic_priority_nullable(self):
        epic = EpicFactory(priority=None)
        assert epic.priority is None

    def test_epic_project_fk(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager)
        epic = EpicFactory(
            created_by=manager,
            project=project,
            organization=manager.organization,
        )
        assert epic.project == project
        assert epic in project.epics.all()

    def test_epic_standalone_without_project(self):
        epic = EpicFactory(project=None)
        assert epic.project is None

    def test_epic_tasks_reverse_fk(self):
        manager = ManagerFactory()
        epic = EpicFactory(created_by=manager, organization=manager.organization)
        task = TaskFactory(
            created_by=manager,
            organization=manager.organization,
            epic=epic,
        )
        assert task in epic.tasks.all()
        assert epic.tasks.count() == 1

    def test_epic_ordering(self):
        manager = ManagerFactory()
        EpicFactory(title="First", created_by=manager)
        EpicFactory(title="Second", created_by=manager)
        epics = list(
            Epic.objects.filter(organization=manager.organization).values_list(
                "title", flat=True
            )
        )
        # ordering is -created_at, so newest first
        assert epics == ["Second", "First"]

    def test_organization_fk_cascade(self):
        """Epic belongs to an organization (CASCADE). Verify the FK is set correctly."""
        epic = EpicFactory()
        assert epic.organization is not None
        assert epic.organization == epic.created_by.organization

    def test_set_null_on_project_delete(self):
        manager = ManagerFactory()
        project = ProjectFactory(created_by=manager)
        epic = EpicFactory(
            created_by=manager,
            project=project,
            organization=manager.organization,
        )
        project.delete()
        epic.refresh_from_db()
        assert epic.project is None
