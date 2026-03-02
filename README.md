# Wearism — Monorepo

A Node.js + Python monorepo for the Wearism fashion app backend.

```
Wearism-Backend/
├── backend/         → Fastify API (Node.js)
├── ai-service/      → FastAPI + Celery AI service (Python)
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker (for Redis)

---

## 1. Start Redis

```bash
docker compose up -d
```

---

## 2. Start the Node.js Backend

```bash
cd backend
npm install       # first time only
npm run dev
```

Runs on **http://localhost:3000**

---

## 3. Start the AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Terminal A — FastAPI
uvicorn main:app --reload --port 8000

# Terminal B — Celery Worker
celery -A celery_app worker --loglevel=info
```

FastAPI runs on **http://localhost:8000**  
API docs at **http://localhost:8000/docs**

---

## 4. Run Tests

```bash
cd backend
npm test
```

---

## Environment Files

| File | Purpose |
|------|---------|
| `backend/.env` | Node.js env vars (Supabase, JWT, AI_SERVICE_URL) |
| `ai-service/.env` | Python env vars (Supabase, Redis URL) |
