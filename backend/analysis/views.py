from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import logging
from .models import AnalysisTask
from .serializers import (
    AnalysisTaskSerializer, 
    BlastTaskCreateSerializer, 
    MsaTaskCreateSerializer, 
    PeptideCalcSerializer,
    PrimerDesignSerializer,
    AntibodyAnnotationSerializer
)
from .tasks import run_blast_task, run_msa_task
from .throttles import AnonBurstRateThrottle, AuthenticatedRateThrottle
from .utils import cumulative_calculator, generate_peptides
from .utils.primer_design import design_primers
from .utils.antibody_annotation import annotate_antibody

logger = logging.getLogger(__name__)

class AnalysisTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View to retrieve task status and results.
    """
    queryset = AnalysisTask.objects.all()
    serializer_class = AnalysisTaskSerializer
    lookup_field = 'id'
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def list(self, request, *args, **kwargs):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

class BlastTaskView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def post(self, request):
        serializer = BlastTaskCreateSerializer(data=request.data)
        if serializer.is_valid():
            task_record = AnalysisTask.objects.create(task_type='BLAST')

            try:
                run_blast_task.delay(
                    task_id=str(task_record.id),
                    sequence=serializer.validated_data['sequence'],
                    evalue=serializer.validated_data['evalue'],
                    db=serializer.validated_data['db']
                )
            except Exception:
                task_record.status = 'FAILURE'
                task_record.error_message = 'Task queue unavailable. Please retry later.'
                task_record.save(update_fields=['status', 'error_message', 'updated_at'])
                logger.exception('Failed to enqueue BLAST task')
                return Response(
                    {'detail': 'Task queue unavailable. Please retry later.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            return Response(AnalysisTaskSerializer(task_record).data, status=status.HTTP_202_ACCEPTED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MsaTaskView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def post(self, request):
        serializer = MsaTaskCreateSerializer(data=request.data)
        if serializer.is_valid():
            task_record = AnalysisTask.objects.create(task_type='MSA')

            try:
                run_msa_task.delay(
                    task_id=str(task_record.id),
                    sequence=serializer.validated_data['sequence']
                )
            except Exception:
                task_record.status = 'FAILURE'
                task_record.error_message = 'Task queue unavailable. Please retry later.'
                task_record.save(update_fields=['status', 'error_message', 'updated_at'])
                logger.exception('Failed to enqueue MSA task')
                return Response(
                    {'detail': 'Task queue unavailable. Please retry later.'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            return Response(AnalysisTaskSerializer(task_record).data, status=status.HTTP_202_ACCEPTED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PeptideCalcView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def post(self, request):
        serializer = PeptideCalcSerializer(data=request.data)
        if serializer.is_valid():
            csv_data = generate_peptides(
                target_mass=serializer.validated_data['target_mass'],
                error_range=serializer.validated_data['error_range'],
                num_amino_acids=serializer.validated_data['num_amino_acids']
            )
            # For simplicity returning CSV string in JSON, could be file download
            return Response({'csv_content': csv_data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SequenceAnalysisView(APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def post(self, request):
        """
        Calculates cumulative properties for uploaded FASTA file or content.
        """
        fasta_file = request.FILES.get('fasta_file')
        fasta_content = request.data.get('fasta_content')

        if not fasta_file and not fasta_content:
            return Response({'error': 'No FASTA data provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if fasta_file:
                # Read file content as string
                content = fasta_file.read().decode('utf-8')
                summary = cumulative_calculator(content)
            else:
                summary = cumulative_calculator(fasta_content)
            
            return Response(summary)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class PrimerDesignView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def post(self, request):
        serializer = PrimerDesignSerializer(data=request.data)
        if serializer.is_valid():
            result = design_primers(
                sequence=serializer.validated_data['sequence'],
                product_size_range=serializer.validated_data['product_size_range'],
                tm_opt=serializer.validated_data['tm_opt']
            )
            if 'error' in result:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            return Response(result)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AntibodyAnnotationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]

    def post(self, request):
        serializer = AntibodyAnnotationSerializer(data=request.data)
        if serializer.is_valid():
            result = annotate_antibody(
                sequence=serializer.validated_data['sequence'],
                scheme=serializer.validated_data['scheme']
            )
            if result.get('status') == 'error':
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            return Response(result)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
