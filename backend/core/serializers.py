from rest_framework import serializers
from .models import Project, AA_Sequence, DNA_Sequence

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'project_id', 'security_key', 'created_at']
        read_only_fields = ['id', 'security_key', 'created_at']

class AA_SequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AA_Sequence
        fields = ['id', 'project', 'sequence', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']

class DNA_SequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DNA_Sequence
        fields = ['id', 'project', 'sequence', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']
