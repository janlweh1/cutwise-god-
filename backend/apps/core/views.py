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
