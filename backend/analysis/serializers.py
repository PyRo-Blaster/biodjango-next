from rest_framework import serializers
from .models import AnalysisTask

class AnalysisTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisTask
        fields = '__all__'
        read_only_fields = ['id', 'status', 'created_at', 'updated_at', 'result', 'error_message']

class BlastTaskCreateSerializer(serializers.Serializer):
    sequence = serializers.CharField()
    evalue = serializers.FloatField(default=1e-6)
    db = serializers.CharField(default='swissprot')

class MsaTaskCreateSerializer(serializers.Serializer):
    sequence = serializers.CharField()

class PeptideCalcSerializer(serializers.Serializer):
    target_mass = serializers.FloatField()
    error_range = serializers.FloatField()
    num_amino_acids = serializers.IntegerField(min_value=1, max_value=20)
