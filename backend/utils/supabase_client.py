"""
Supabase client utility for server-side operations.

Usage:
    from utils.supabase_client import get_supabase_client
    supabase = get_supabase_client()
"""

from django.conf import settings
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Return an initialised Supabase client using the service-role key."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_anon_client() -> Client:
    """Return an initialised Supabase client using the anon key."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
