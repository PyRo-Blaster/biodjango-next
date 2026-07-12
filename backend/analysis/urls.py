from django.urls import path
from .views import (
    AnalysisTaskRetrieveView,
    BlastTaskView,
    MsaTaskView,
    PeptideCalcView,
    SequenceAnalysisView,
    PrimerDesignView,
    AntibodyAnnotationView,
)


urlpatterns = [
    path('tasks/<uuid:id>/', AnalysisTaskRetrieveView.as_view(), name='task-detail'),
    path('blast/', BlastTaskView.as_view(), name='run-blast'),
    path('msa/', MsaTaskView.as_view(), name='run-msa'),
    path('peptide-calc/', PeptideCalcView.as_view(), name='peptide-calc'),
    path('sequence-analysis/', SequenceAnalysisView.as_view(), name='sequence-analysis'),
    path('primer-design/', PrimerDesignView.as_view(), name='primer-design'),
    path('antibody-annotation/', AntibodyAnnotationView.as_view(), name='antibody-annotation'),
]
