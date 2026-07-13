from django.urls import path
from .views import (
    AnalysisTaskResultView,
    AnalysisTaskRetrieveView,
    AntibodyAnnotationView,
    BlastTaskView,
    MsaTaskView,
    PeptideCalcView,
    PrimerDesignView,
    SequenceAnalysisView,
)


urlpatterns = [
    path('tasks/<uuid:id>/', AnalysisTaskRetrieveView.as_view(), name='task-detail'),
    path('tasks/<uuid:id>/result/', AnalysisTaskResultView.as_view(), name='task-result'),
    path('blast/', BlastTaskView.as_view(), name='run-blast'),
    path('msa/', MsaTaskView.as_view(), name='run-msa'),
    path('peptide-calc/', PeptideCalcView.as_view(), name='peptide-calc'),
    path('sequence-analysis/', SequenceAnalysisView.as_view(), name='sequence-analysis'),
    path('primer-design/', PrimerDesignView.as_view(), name='primer-design'),
    path('antibody-annotation/', AntibodyAnnotationView.as_view(), name='antibody-annotation'),
]
