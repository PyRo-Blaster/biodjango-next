from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ProteinSequenceViewSet, AccessRequestViewSet

router = DefaultRouter()
router.register(r"sequences", ProteinSequenceViewSet, basename="sequences")
router.register(r"access-requests", AccessRequestViewSet, basename="access-requests")
router.register(r"", ProjectViewSet, basename="projects")

urlpatterns = [
    path('', include(router.urls)),
]
