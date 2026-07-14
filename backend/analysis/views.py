import logging

from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import log_action
from core.models import AuditLog

from .models import AnalysisTask
from .serializers import (
    AnalysisTaskSerializer,
    AnalysisTaskStatusSerializer,
    AntibodyAnnotationSerializer,
    BlastTaskCreateSerializer,
    MsaTaskCreateSerializer,
    PeptideCalcSerializer,
    PrimerDesignSerializer,
)
from .tasks import (
    run_antibody_annotation_task,
    run_blast_task,
    run_msa_task,
    run_peptide_calc_task,
    run_primer_design_task,
)
from .throttles import TaskPollThrottle
from .utils import cumulative_calculator

logger = logging.getLogger(__name__)


class AnalysisTaskRetrieveView(generics.RetrieveAPIView):
    """Lightweight status endpoint used by polling."""

    queryset = AnalysisTask.objects.all()
    serializer_class = AnalysisTaskStatusSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'id'
    permission_classes = [IsAuthenticated]
    throttle_classes = [TaskPollThrottle]


class AnalysisTaskResultView(generics.RetrieveAPIView):
    """Full task detail including the ``result`` payload."""

    queryset = AnalysisTask.objects.all()
    serializer_class = AnalysisTaskSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'id'
    permission_classes = [IsAuthenticated]


def _dispatch(request, task_type, task_fn, **kwargs):
    """Create an ``AnalysisTask`` row and dispatch the Celery task.

    Returns ``(task, None)`` on success, or ``(None, response)`` describing the
    503 when the broker is unreachable. Emits a SUBMIT audit row on success so
    "who ran what analysis" is answerable from the audit log.
    """
    task_record = AnalysisTask.objects.create(task_type=task_type)
    try:
        task_fn.delay(task_id=str(task_record.id), **kwargs)
    except Exception:
        task_record.status = 'FAILURE'
        task_record.error_message = 'Task queue unavailable. Please retry later.'
        task_record.save(update_fields=['status', 'error_message', 'updated_at'])
        logger.exception('Failed to enqueue %s task', task_type)
        return None, Response(
            {'detail': 'Task queue unavailable. Please retry later.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    log_action(
        request=request,
        action=AuditLog.Action.SUBMIT,
        target=task_record,
        details={'task_type': task_type},
    )
    return task_record, None


class BlastTaskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = BlastTaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task_record, err = _dispatch(
            request,
            'BLAST',
            run_blast_task,
            sequence=serializer.validated_data['sequence'],
            evalue=serializer.validated_data['evalue'],
            db=serializer.validated_data['db'],
        )
        if err is not None:
            return err
        return Response(
            AnalysisTaskStatusSerializer(task_record).data,
            status=status.HTTP_202_ACCEPTED,
        )


class MsaTaskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MsaTaskCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task_record, err = _dispatch(
            request,
            'MSA',
            run_msa_task,
            sequence=serializer.validated_data['sequence'],
        )
        if err is not None:
            return err
        return Response(
            AnalysisTaskStatusSerializer(task_record).data,
            status=status.HTTP_202_ACCEPTED,
        )


class PeptideCalcView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PeptideCalcSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task_record, err = _dispatch(
            request,
            'PEPTIDE_CALC',
            run_peptide_calc_task,
            target_mass=serializer.validated_data['target_mass'],
            error_range=serializer.validated_data['error_range'],
            num_amino_acids=serializer.validated_data['num_amino_acids'],
        )
        if err is not None:
            return err
        return Response(
            AnalysisTaskStatusSerializer(task_record).data,
            status=status.HTTP_202_ACCEPTED,
        )


class SequenceAnalysisView(APIView):
    """FASTA cumulative summary — stays synchronous (fast, accepts file upload)."""

    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [IsAuthenticated]

    def post(self, request):
        fasta_file = request.FILES.get('fasta_file')
        fasta_content = request.data.get('fasta_content')

        if not fasta_file and not fasta_content:
            return Response({'error': 'No FASTA data provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if fasta_file:
                content = fasta_file.read().decode('utf-8')
                summary = cumulative_calculator(content)
            else:
                summary = cumulative_calculator(fasta_content)
            return Response(summary)
        except Exception as exc:
            logger.exception("Sequence-analysis view failed")
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class PrimerDesignView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PrimerDesignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task_record, err = _dispatch(
            request,
            'PRIMER_DESIGN',
            run_primer_design_task,
            sequence=serializer.validated_data['sequence'],
            product_size_range=serializer.validated_data['product_size_range'],
            tm_opt=serializer.validated_data['tm_opt'],
        )
        if err is not None:
            return err
        return Response(
            AnalysisTaskStatusSerializer(task_record).data,
            status=status.HTTP_202_ACCEPTED,
        )


class AntibodyAnnotationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AntibodyAnnotationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        task_record, err = _dispatch(
            request,
            'ANTIBODY_ANNOTATION',
            run_antibody_annotation_task,
            sequence=serializer.validated_data['sequence'],
            scheme=serializer.validated_data['scheme'],
        )
        if err is not None:
            return err
        return Response(
            AnalysisTaskStatusSerializer(task_record).data,
            status=status.HTTP_202_ACCEPTED,
        )
