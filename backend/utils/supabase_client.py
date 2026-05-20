"""
Supabase client utility for server-side operations.

Usage:
    from utils.supabase_client import get_supabase_client
    supabase = get_supabase_client()
"""

from django.conf import settings
from supabase import create_client, Client


_supabase_client = None
_supabase_anon_client = None

def get_supabase_client() -> Client:
    """Return a cached Supabase client using the service-role key."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client


def get_supabase_anon_client() -> Client:
    """Return a cached Supabase client using the anon key."""
    global _supabase_anon_client
    if _supabase_anon_client is None:
        _supabase_anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _supabase_anon_client

