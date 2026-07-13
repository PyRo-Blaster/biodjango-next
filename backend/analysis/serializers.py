from rest_framework import serializers
from .models import AnalysisTask


class AnalysisTaskStatusSerializer(serializers.ModelSerializer):
    """Lightweight polling shape — no result payload."""

    class Meta:
        model = AnalysisTask
        fields = ['id', 'task_type', 'status', 'error_message', 'updated_at']
        read_only_fields = fields


class AnalysisTaskSerializer(serializers.ModelSerializer):
    """Full task detail including result — served from the result endpoint."""

    class Meta:
        model = AnalysisTask
        fields = [
            'id',
            'task_type',
            'status',
            'created_at',
            'updated_at',
            'result',
            'error_message',
        ]
        read_only_fields = fields


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


class PrimerDesignSerializer(serializers.Serializer):
    sequence = serializers.CharField()
    product_size_range = serializers.CharField(default="100-300", help_text="e.g. 100-300")
    tm_opt = serializers.FloatField(default=60.0)


class AntibodyAnnotationSerializer(serializers.Serializer):
    sequence = serializers.CharField()
    scheme = serializers.ChoiceField(choices=['imgt', 'kabat', 'chothia'], default='imgt')
