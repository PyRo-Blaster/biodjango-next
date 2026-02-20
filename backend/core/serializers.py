from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import Project, AA_Sequence, DNA_Sequence

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff

        return token

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'password_confirm', 'email')

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data.get('email', '')
        )
        user.set_password(validated_data['password'])
        user.save()
        return user

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
