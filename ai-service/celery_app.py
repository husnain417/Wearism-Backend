import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')

celery = Celery(
    'wearism_ai',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        'tasks.clothing_tasks',
        'tasks.outfit_tasks',
        'tasks.user_tasks',
    ],
)

celery.conf.update(
    # Task serialisation
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],

    # Timezone
    timezone='UTC',
    enable_utc=True,

    # Reliability — only ack after task succeeds; re-queue if worker crashes
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,   # one task at a time per worker (AI is heavy)

    # Timeouts
    task_soft_time_limit=60,        # raises SoftTimeLimitExceeded after 60s
    task_time_limit=90,             # hard kill after 90s

    # Keep results in Redis for 24 hours
    result_expires=86400,

    # Separate queues per task type — scale workers independently
    task_routes={
        'tasks.clothing_tasks.*': {'queue': 'clothing'},
        'tasks.outfit_tasks.*':   {'queue': 'outfits'},
        'tasks.user_tasks.*':     {'queue': 'users'},
    },

    # Retry settings
    task_default_retry_delay=10,
    task_max_retries=3,
)
