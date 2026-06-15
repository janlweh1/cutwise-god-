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

    # Admin: user management
    path("users/", views.UserListView.as_view(), name="user-list"),
    path("users/<int:pk>/", views.UserDetailView.as_view(), name="user-detail"),
    path("users/<int:pk>/deactivate/", views.UserDeactivateView.as_view(), name="user-deactivate"),

    # Self-service
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
]
