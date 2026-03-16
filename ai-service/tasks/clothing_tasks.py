import asyncio
import time
from celery_app import celery
from models.stubs import classify_clothing_model
from db.supabase_client import update_wardrobe_item, update_ai_result


@celery.task(
    bind=True,
    name='tasks.clothing_tasks.classify_clothing',
    max_retries=3,
    default_retry_delay=10,
)
def classify_clothing(self, item_id: str, image_url: str, ai_result_id: str):
    """
    Celery task: classify a single clothing item.
    Called by Fastify after a wardrobe item is created.
    Writes results directly to Supabase.
    """
    start_time = time.time()

    try:
        # Mark the ai_results row as 'processing'
        asyncio.run(update_ai_result(ai_result_id, {'status': 'processing'}))

        # Run the model (stub or real)
        result = asyncio.run(classify_clothing_model(image_url, item_id))

        processing_ms = int((time.time() - start_time) * 1000)

        # Build the wardrobe item update payload
        item_updates = {
            'wardrobe_slot':              result.wardrobe_slot,
            'fashionclip_main_category':  result.fashionclip_main_category,
            'fashionclip_sub_category':   result.fashionclip_sub_category,
            'fashionclip_attributes':     result.fashionclip_attributes,
            'fashionclip_description':    result.fashionclip_description,
            'color_dominant_rgb':         result.color_dominant_rgb,
            'pattern_strength':           result.pattern_strength,
            'texture_score':              result.texture_score,
            'formality_score':            result.formality_score,
            'is_accessory':               result.is_accessory,
            'tag':                        result.tag,
        }

        # Conditionally add optional fields
        if result.fashionclip_image_vector:
            item_updates['fashionclip_image_vector'] = result.fashionclip_image_vector
        if result.sam_label:
            item_updates['sam_label']      = result.sam_label
            item_updates['sam_confidence'] = result.sam_confidence

        # Write classification to wardrobe_items
        asyncio.run(update_wardrobe_item(item_id, item_updates))

        # Mark ai_results as completed
        asyncio.run(update_ai_result(ai_result_id, {
            'status':             'completed',
            'result':             result.model_dump(),
            'processing_time_ms': processing_ms,
            'model_version':      result.model_version,
        }))

        return {'status': 'completed', 'item_id': item_id}

    except Exception as exc:
        processing_ms = int((time.time() - start_time) * 1000)

        asyncio.run(update_ai_result(ai_result_id, {
            'status':             'failed',
            'error_message':      str(exc),
            'processing_time_ms': processing_ms,
        }))

        # Exponential backoff: 10s, 20s, 40s
        raise self.retry(exc=exc, countdown=10 * (2 ** self.request.retries))
