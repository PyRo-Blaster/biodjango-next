from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AnalysisTaskViewSet,
    BlastTaskView,
    MsaTaskView,
    PeptideCalcView,
    SequenceAnalysisView
)

router = DefaultRouter()
router.register(r'tasks', AnalysisTaskViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('blast/', BlastTaskView.as_view(), name='run-blast'),
    path('msa/', MsaTaskView.as_view(), name='run-msa'),
    path('peptide-calc/', PeptideCalcView.as_view(), name='peptide-calc'),
    path('sequence-analysis/', SequenceAnalysisView.as_view(), name='sequence-analysis'),
]
