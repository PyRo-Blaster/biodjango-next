from rest_framework import viewsets, status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import AnalysisTask
from .serializers import (
    AnalysisTaskSerializer, 
    BlastTaskCreateSerializer, 
    MsaTaskCreateSerializer, 
    PeptideCalcSerializer
)
from .tasks import run_blast_task, run_msa_task
from .utils import cumulative_calculator, generate_peptides
import io

class AnalysisTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View to retrieve task status and results.
    """
    queryset = AnalysisTask.objects.all()
    serializer_class = AnalysisTaskSerializer
    lookup_field = 'id'

class BlastTaskView(APIView):
    def post(self, request):
        serializer = BlastTaskCreateSerializer(data=request.data)
        if serializer.is_valid():
            task_record = AnalysisTask.objects.create(task_type='BLAST')
            
            # Dispatch Celery Task
            run_blast_task.delay(
                task_id=str(task_record.id),
                sequence=serializer.validated_data['sequence'],
                evalue=serializer.validated_data['evalue'],
                db=serializer.validated_data['db']
            )
            
            return Response(AnalysisTaskSerializer(task_record).data, status=status.HTTP_202_ACCEPTED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MsaTaskView(APIView):
    def post(self, request):
        serializer = MsaTaskCreateSerializer(data=request.data)
        if serializer.is_valid():
            task_record = AnalysisTask.objects.create(task_type='MSA')
            
            # Dispatch Celery Task
            run_msa_task.delay(
                task_id=str(task_record.id),
                sequence=serializer.validated_data['sequence']
            )
            
            return Response(AnalysisTaskSerializer(task_record).data, status=status.HTTP_202_ACCEPTED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PeptideCalcView(APIView):
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
