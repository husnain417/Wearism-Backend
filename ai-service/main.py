import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv

from schemas.requests import (
    ClassifyClothingRequest, ClassifyClothingResponse,
    RateOutfitRequest, RateOutfitResponse,
    AnalyseUserRequest, AnalyseUserResponse,
    QueueRateOutfitRequest, QueueRateRecommendationRequest,
)
from models.stubs import classify_clothing_model, rate_outfit_model, analyse_user_model

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('wearism.ai')

INTERNAL_SECRET = os.getenv('AI_SHARED_SECRET')
ENVIRONMENT     = os.getenv('ENVIRONMENT', 'development')


# ── SECURITY: Shared secret validation ───────────────────

async def verify_internal_secret(
    x_internal_secret: str = Header(..., alias='X-Internal-Secret')
):
    if not INTERNAL_SECRET:
        raise RuntimeError('AI_SHARED_SECRET not configured')
    if x_internal_secret != INTERNAL_SECRET:
        logger.warning('Rejected request with invalid internal secret')
        raise HTTPException(status_code=401, detail='Unauthorized')


# ── APP ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f'Wearism AI Service starting — env: {ENVIRONMENT}')
    yield
    logger.info('Wearism AI Service shutting down')


app = FastAPI(
    title='Wearism AI Service',
    version='1.0.0',
    docs_url='/docs' if ENVIRONMENT == 'development' else None,  # disable in prod
    redoc_url=None,
    lifespan=lifespan,
)

# Only accept requests from localhost in all environments
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=['localhost', '127.0.0.1', '::1'],
)


# ── HEALTH CHECK ─────────────────────────────────────────

@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'wearism-ai', 'environment': ENVIRONMENT}


# ── CLOTHING CLASSIFICATION ───────────────────────────────

@app.post(
    '/classify/clothing',
    response_model=ClassifyClothingResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def classify_clothing(request: ClassifyClothingRequest):
    start = time.time()
    logger.info(f'Classifying clothing item {request.item_id}')

    result = await classify_clothing_model(request.image_url, request.item_id)

    logger.info(f'Classified {request.item_id} in {round((time.time() - start) * 1000)}ms')
    return result


# ── OUTFIT RATING ─────────────────────────────────────────

@app.post(
    '/rate/outfit',
    response_model=RateOutfitResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def rate_outfit(request: RateOutfitRequest):
    start = time.time()
    logger.info(f'Rating outfit {request.outfit_id} ({len(request.items)} items)')

    result = await rate_outfit_model(request.outfit_id, request.items, request.user_profile)

    logger.info(f'Rated outfit {request.outfit_id} in {round((time.time() - start) * 1000)}ms')
    return result


# ── USER ANALYSIS ─────────────────────────────────────────

@app.post(
    '/analyse/user',
    response_model=AnalyseUserResponse,
    dependencies=[Depends(verify_internal_secret)],
)
async def analyse_user(request: AnalyseUserRequest):
    start = time.time()
    logger.info(f'Analysing user photo for user {request.user_id}')

    result = await analyse_user_model(request.image_url, request.user_id)

    logger.info(f'Analysed user {request.user_id} in {round((time.time() - start) * 1000)}ms')
    return result


# ── INTERNAL QUEUE BRIDGE (Node.js -> Celery) ─────────────

@app.post(
    '/queue/classify/clothing',
    dependencies=[Depends(verify_internal_secret)],
)
async def queue_classify_clothing(request: ClassifyClothingRequest):
    from tasks.clothing_tasks import classify_clothing
    task = classify_clothing.delay(request.item_id, request.image_url, request.ai_result_id)
    return {'status': 'queued', 'task_id': task.id}


@app.post(
    '/queue/rate/outfit',
    dependencies=[Depends(verify_internal_secret)],
)
async def queue_rate_outfit(request: QueueRateOutfitRequest):
    from tasks.outfit_tasks import rate_outfit
    task = rate_outfit.delay(
        request.outfit_id, 
        request.ai_result_id,
        request.season,
        request.occasion,
        request.weather
    )
    return {'status': 'queued', 'task_id': task.id}


@app.post(
    '/queue/rate/recommendation',
    dependencies=[Depends(verify_internal_secret)],
)
async def queue_rate_recommendation(request: QueueRateRecommendationRequest):
    from tasks.outfit_tasks import rate_recommendation
    task = rate_recommendation.delay(
        request.recommendation_id, 
        [item.dict() for item in request.items], 
        request.ai_result_id,
        request.user_id,
        request.season,
        request.occasion,
        request.weather
    )
    return {'status': 'queued', 'task_id': task.id}


@app.post(
    '/queue/analyse/user',
    dependencies=[Depends(verify_internal_secret)],
)
async def queue_analyse_user(request: AnalyseUserRequest):
    from tasks.user_tasks import analyse_user
    task = analyse_user.delay(request.user_id, request.image_url, request.ai_result_id)
    return {'status': 'queued', 'task_id': task.id}

