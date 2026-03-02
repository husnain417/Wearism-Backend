import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
        # Use service_role key — worker writes to DB without user context
        _client = create_client(url, key)
    return _client


async def update_wardrobe_item(item_id: str, updates: dict):
    """Write AI classification results to wardrobe_items table."""
    db = get_supabase()
    db.table('wardrobe_items').update(updates).eq('id', item_id).execute()


async def update_ai_result(result_id: str, updates: dict):
    """Update ai_results row with completion status and result JSON."""
    db = get_supabase()
    db.table('ai_results').update(updates).eq('id', result_id).execute()


async def update_outfit(outfit_id: str, updates: dict):
    """Write AI outfit rating results to outfits table."""
    db = get_supabase()
    db.table('outfits').update(updates).eq('id', outfit_id).execute()
