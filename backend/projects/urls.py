from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ProteinSequenceViewSet, AccessRequestViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'sequences', ProteinSequenceViewSet, basename='sequences')
router.register(r'access-requests', AccessRequestViewSet, basename='access-requests')

urlpatterns = [
    path('', include(router.urls)),
]
