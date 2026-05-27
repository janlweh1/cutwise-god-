from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = "authentication"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.CustomTokenObtainPairView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", views.current_user, name="current-user"),
    path("forgot-password/", views.forgot_password, name="forgot-password"),
]
