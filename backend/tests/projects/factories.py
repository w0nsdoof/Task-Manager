import factory
from django.utils import timezone

from apps.projects.models import Epic, Project
from tests.factories import ManagerFactory


class ProjectFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Project
        skip_postgeneration_save = True

    title = factory.Sequence(lambda n: f"Project {n}")
    description = factory.Faker("paragraph")
    priority = Project.Priority.MEDIUM
    status = Project.Status.CREATED
    deadline = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=30))
    created_by = factory.SubFactory(ManagerFactory)
    organization = factory.LazyAttribute(lambda o: o.created_by.organization)

    @factory.post_generation
    def tags(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        self.tags.set(extracted)


class EpicFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Epic
        skip_postgeneration_save = True

    title = factory.Sequence(lambda n: f"Epic {n}")
    description = factory.Faker("paragraph")
    priority = Epic.Priority.MEDIUM
    status = Epic.Status.CREATED
    deadline = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=14))
    created_by = factory.SubFactory(ManagerFactory)
    organization = factory.LazyAttribute(lambda o: o.created_by.organization)

    @factory.post_generation
    def tags(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        self.tags.set(extracted)
