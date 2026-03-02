import asyncio
import time
from celery_app import celery
from models.stubs import analyse_user_model
from db.supabase_client import update_ai_result, get_supabase


@celery.task(
    bind=True,
    name='tasks.user_tasks.analyse_user',
    max_retries=2,
    default_retry_delay=10,
)
def analyse_user(self, user_id: str, image_url: str, ai_result_id: str):
    """
    Celery task: estimate age range and height from user photo.
    Only updates profile fields that the user hasn't set manually.
    """
    start_time = time.time()

    try:
        asyncio.run(update_ai_result(ai_result_id, {'status': 'processing'}))

        result = asyncio.run(analyse_user_model(image_url, user_id))
        processing_ms = int((time.time() - start_time) * 1000)

        # Only update profile fields that haven't been manually set
        db = get_supabase()
        profile = (
            db.table('profiles')
            .select('age_range, height_cm')
            .eq('id', user_id)
            .single()
            .execute()
        )

        profile_updates = {}
        if profile.data:
            if not profile.data.get('age_range'):
                profile_updates['age_range'] = result.estimated_age_range
            if not profile.data.get('height_cm'):
                profile_updates['height_cm'] = result.estimated_height_cm

        if profile_updates:
            db.table('profiles').update(profile_updates).eq('id', user_id).execute()

        asyncio.run(update_ai_result(ai_result_id, {
            'status':             'completed',
            'result':             result.model_dump(),
            'processing_time_ms': processing_ms,
            'model_version':      result.model_version,
        }))

        return {'status': 'completed', 'user_id': user_id}

    except Exception as exc:
        asyncio.run(update_ai_result(ai_result_id, {
            'status': 'failed', 'error_message': str(exc),
        }))
        raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))
