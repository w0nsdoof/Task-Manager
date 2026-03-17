from rest_framework.routers import DefaultRouter

from apps.projects.views import EpicViewSet

router = DefaultRouter()
router.register("", EpicViewSet, basename="epic")

urlpatterns = router.urls
