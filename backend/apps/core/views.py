from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint to verify API is running."""
    return Response({
        "status": "healthy",
        "service": "CutWise IMS API",
        "version": "1.0.0",
    })


import os
from django.conf import settings

@api_view(["POST"])
@permission_classes([AllowAny])
def client_log(request):
    """Log messages sent from the frontend client to the backend console and a file."""
    message = request.data.get("message", "")
    level = request.data.get("level", "info")
    log_line = f"[CLIENT {level.upper()}] {message}\n"
    print(f"\n{log_line}")
    
    log_file_path = os.path.join(settings.BASE_DIR, "frontend_debug.log")
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write to frontend_debug.log: {e}")
        
    return Response({"status": "logged"})
