from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, AA_SequenceViewSet, DNA_SequenceViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet)
router.register(r'aa-sequences', AA_SequenceViewSet)
router.register(r'dna-sequences', DNA_SequenceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
