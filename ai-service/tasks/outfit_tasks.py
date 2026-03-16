import asyncio
import time
from celery_app import celery
from models.stubs import rate_outfit_model
from db.supabase_client import update_outfit, update_ai_result, get_supabase
from schemas.requests import OutfitItem, UserProfile


@celery.task(
    bind=True,
    name='tasks.outfit_tasks.rate_outfit',
    max_retries=3,
    default_retry_delay=15,
)
def rate_outfit(self, outfit_id: str, ai_result_id: str,
                season: str = None, occasion: str = None, weather: str = None):
    """
    Celery task: fetch outfit items from DB and rate the outfit.
    Writes AI scores back to the outfits table.
    """
    start_time = time.time()

    try:
        asyncio.run(update_ai_result(ai_result_id, {'status': 'processing'}))

        db = get_supabase()

        # Fetch outfit items with classification data
        outfit_data = (
            db.table('outfit_items')
            .select('wardrobe_items(id, category, colors, pattern, fit)')
            .eq('outfit_id', outfit_id)
            .execute()
        )

        if not outfit_data.data:
            raise ValueError(f'No items found for outfit {outfit_id}')

        # Fetch user profile for personalised rating
        outfit_row = (
            db.table('outfits')
            .select('user_id, profiles(body_type, skin_tone, age_range, height_cm)')
            .eq('id', outfit_id)
            .single()
            .execute()
        )

        items = []
        for row in outfit_data.data:
            wi = row['wardrobe_items']
            items.append(OutfitItem(
                item_id  = wi['id'],
                category = wi.get('category') or 'unknown',
                colors   = wi.get('colors') or [],
                pattern  = wi.get('pattern'),
                fit      = wi.get('fit'),
            ))

        profile_data = outfit_row.data.get('profiles', {}) if outfit_row.data else {}
        user_profile = UserProfile(**profile_data) if profile_data else None

        result = asyncio.run(rate_outfit_model(
            outfit_id,
            items,
            user_profile,
            season=season,
            occasion=occasion,
            weather=weather,
        ))
        processing_ms = int((time.time() - start_time) * 1000)

        # Write scores to outfits table
        asyncio.run(update_outfit(outfit_id, {
            'ai_rating':           result.rating,
            'ai_color_score':      result.color_score,
            'ai_proportion_score': result.proportion_score,
            'ai_style_score':      result.style_score,
            'ai_feedback':         result.feedback,
        }))

        asyncio.run(update_ai_result(ai_result_id, {
            'status':             'completed',
            'result':             result.model_dump(),
            'processing_time_ms': processing_ms,
            'model_version':      result.model_version,
        }))

        return {'status': 'completed', 'outfit_id': outfit_id}

    except Exception as exc:
        asyncio.run(update_ai_result(ai_result_id, {
            'status': 'failed', 'error_message': str(exc),
        }))
        raise self.retry(exc=exc, countdown=15 * (2 ** self.request.retries))


@celery.task(
    bind=True,
    name='tasks.outfit_tasks.rate_recommendation',
    max_retries=3,
    default_retry_delay=10,
)
def rate_recommendation(self, recommendation_id: str, items: list,
                        ai_result_id: str, user_id: str,
                        season: str = None, occasion: str = None,
                        weather: str = None):
    """
    Celery task: rate a system-generated recommendation combination.
    Unlike rate_outfit, items are passed directly (not fetched from DB)
    because recommendations don't have outfit_items junction rows yet.
    """
    start_time = time.time()

    try:
        asyncio.run(update_ai_result(ai_result_id, {'status': 'processing'}))

        # Fetch user profile for personalised scoring
        db = get_supabase()
        profile_data = (
            db.table('profiles')
            .select('body_type, skin_tone, age_range, height_cm')
            .eq('id', user_id)
            .single()
            .execute()
        )

        user_profile = None
        if profile_data.data:
            user_profile = UserProfile(**{
                k: v for k, v in profile_data.data.items() if v is not None
            })

        outfit_items = [OutfitItem(**item) for item in items]

        result = asyncio.run(rate_outfit_model(
            recommendation_id,
            outfit_items,
            user_profile,
            season=season,
            occasion=occasion,
            weather=weather,
        ))

        processing_ms = int((time.time() - start_time) * 1000)

        # Write scores back to recommendations table (not outfits)
        db.table('recommendations').update({
            'ai_rating':           result.rating,
            'ai_color_score':      result.color_score,
            'ai_proportion_score': result.proportion_score,
            'ai_style_score':      result.style_score,
            'ai_feedback':         result.feedback,
            'ai_status':           'completed',
        }).eq('id', recommendation_id).execute()

        asyncio.run(update_ai_result(ai_result_id, {
            'status':             'completed',
            'result':             result.model_dump(),
            'processing_time_ms': processing_ms,
            'model_version':      result.model_version,
        }))

        return {'status': 'completed', 'recommendation_id': recommendation_id}

    except Exception as exc:
        db = get_supabase()
        db.table('recommendations').update({
            'ai_status': 'failed'
        }).eq('id', recommendation_id).execute()

        asyncio.run(update_ai_result(ai_result_id, {
            'status': 'failed', 'error_message': str(exc),
        }))

        raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))
