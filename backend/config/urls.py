"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from core.views import RegisterView, CustomTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/core/', include('core.urls')),
    path('api/analysis/', include('analysis.urls')),
    path('api/projects/', include('projects.urls')),
    
    # Auth Endpoints
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
