# Wearism Backend Context

## 1. Project Overview
Wearism is a modern backend application. This document serves as the primary source of truth for AI agents working on this codebase, providing architectural guidelines, current state, and conventions. 

## 2. Technology Stack
- **Runtime Environment:** Node.js (v20+ target)
- **Module System:** ES Modules (`"type": "module"` in `package.json`)
- **API Framework:** Fastify (v5)
- **AI Service Framework:** FastAPI (Python 3.12+)
- **Queue System:** BullMQ (Node.js) + Celery (Python)
- **Message Broker:** Redis (v7, password protected)
- **Validation:** JSON Schema (Fastify) + Pydantic (FastAPI)
- **Database & Auth:** Supabase (PostgreSQL)
  - using `@supabase/supabase-js` and `supabase-py`
  - Client configured in `src/config/supabase.js` and `ai-service/db/supabase_client.py` using `SERVICE_ROLE_KEY`
- **Environment Management:** `@fastify/env` (Node) and `python-dotenv` (Python)
- **Logging:** Pino (Node) and standard `logging` (Python)
- **Security:** `@fastify/helmet`, `@fastify/cors`, `TrustedHostMiddleware` (FastAPI), Shared Internal Secret (`AI_SHARED_SECRET`)
- **Authentication Strategy:** JWT via `@fastify/jwt` (and Supabase Auth)
- **Image Processing:** `sharp` (Node) and `Pillow` (Python)
- **Linting & Formatting:** ESLint/Prettier (Node) and standard Python conventions

## 3. Architecture & Folder Structure
The codebase follows a modular, feature-based architecture to keep concerns isolated:

```
wearism/
├── docker-compose.yml       # Local Redis + volumes
├── backend/                 # Fastify Node.js Backend
│   ├── server.js            # Entry point
│   ├── src/
│   │   ├── app.js           # Fastify app factory setup
│   │   ├── config/          # Centralized configuration (env, supabase, redis)
│   │   ├── services/        # BullMQ Queue producers (`aiQueue.js`)
│   │   ├── middleware/      # Shared hooks (auth, UUID, rateLimit)
│   │   └── modules/         # Feature modules (isolated)
│   └── __tests__/           # Integration tests
├── ai-service/              # FastAPI Python AI Service
│   ├── main.py              # FastAPI Entry point
│   ├── celery_app.py        # Celery worker configuration
│   ├── tasks/               # Background task definitions
│   ├── models/              # AI Model stubs/wrappers
│   ├── schemas/             # Pydantic validation models
│   └── db/                  # Python Supabase client
├── docs/                    # API and architectural documentation
└── context.md               # This document
```

### Module Pattern Convention
Every feature module inside `src/modules/` adheres to a strict 3-4 file pattern:
1. `*.routes.js` - Fastify route definitions & schema attaching
2. `*.controller.js` - HTTP request/response handling
3. `*.service.js` - (Optional but recommended) Business logic & database calls
4. `*.schema.js` - JSON schemas for request validation & response serialization

## 4. Current State & Implementation Phases
**Phase 0: Project Foundation - COMPLETED**
- Git initialized with proper `.gitignore`
- Essential dependencies installed
- Folder structure created
- Supabase connected & tested
- `server.js` and Fastify `buildApp()` configured
- ESLint and Prettier setup

**Phase 1: Initializing Authentication - COMPLETED**
- [x] Created placeholder files for the `auth` module (`auth.routes.js`, `auth.controller.js`, `auth.schema.js`, `auth.service.js`).
- [x] Initialized JSON Schema validation (`auth.schema.js`)
- [x] Initialized Supabase service interactions (`auth.service.js`)
- [x] Initialized Controller orchestration (`auth.controller.js`)
- [x] Implemented JWT routing and Fastify plugin integration.
- [x] Implemented `authenticate.js` middleware for protecting endpoints.
- [x] Handled Fastify rate limiting (global and endpoint specific).
- [x] Implemented Right to Access (GDPR Article 15) `me/data` endpoint.
- [x] Validated logic via Jest integration tests and configured the test runner.

**Phase 2: User Profile & Image Processing - COMPLETED**
- [x] Created `imageProcessor.js` using `sharp` for avatar scaling and heavy compression.
- [x] Implemented logic to strip undefined keys from partial update schemas ensuring GDPR data minimisation.
- [x] Configured Supabase to auto-evaluate profile completion % via Postgres Function (`004_profile_completion.sql`).
- [x] Configured Fastify `app.js` with `fastifyMultipart` 5MB bounds for image uploads.
- [x] Ensured GDPR log redaction for sensitive physical data using `pino` redact configurations.
- [x] Added `deleteAvatar` to Auth Service `deleteAccount` sequence preventing orphaned images in bucket.

**Phase 3: Wardrobe Module - COMPLETED**
- [x] Implemented wardrobe item CRUD with Fastify JSON Schema validation (`wardrobe.schema.js`).
- [x] `wardrobeService` with image path ownership validation, 500-item size cap, signed URL generation.
- [x] Outfit CRUD with junction table management (`outfit_items`).
- [x] registered `/wardrobe` and `/wardrobe/outfits` routes in `app.js`.

**Phase 4: AI Service Integration - COMPLETED**
- [x] Restructured into Monorepo with `backend/` and `ai-service/` subdirectories.
- [x] Implemented secure Redis setup via Docker Compose (Password protected, localhost-only).
- [x] Swapped Phase 3 `setInterval` worker for `BullMQ` (Fastify) and `Celery` (Python) job queues.
- [x] Created `ai-service` using FastAPI with `TrustedHostMiddleware` and `AI_SHARED_SECRET` security.
- [x] Implemented async stub models for classification, outfit rating, and user analysis.
- [x] Decoupled Write-Flow: Celery worker writes results directly to Supabase using Python client.
- [x] Hardened per-user rate limiting (10 classification jobs/hour) on Fastify side.
- [x] Implemented `flower` for real-time Celery task monitoring.

**Phase 5: Recommendations Module - COMPLETED**
- [x] Built the `combinationEngine.js` for intelligent outfit building with dynamic occasion/season filtering and color validation.
- [x] Initialized `/recommendations` API endpoints (`generate`, `list`, `getOne`, `save`, `dismiss`) to orchestrate the generation and lifecycle of recommendations.
- [x] Enforced strict ownership scoping and data isolation at the service level on all operations.
- [x] Addressed computationally heavy endpoints by enforcing Fastify Rate Limiting.
- [x] Added Python Celery Worker `rate_recommendation` task for asynchronous scoring of combinations.
- [x] Wrote an extensive integration test suite (`recommendations.test.js` & `combinationEngine.test.js`) resolving 429 quota isolation, resulting in 100% test pass rate.

## 5. Coding Guidelines for AI Agents
1. **Always use ES Modules (`import`/`export`).** Never use `require`.
2. **Never expose the `service_role` key.** Only use `src/config/supabase.js` for DB interactions on the backend.
3. **Use Fastify's built-in features.** Prefer `app.log` over `console.log`. Use Fastify schema validation instead of custom validation logic where possible.
4. **Update this document.** Whenever a new module is completed, a new plugin is added, or a significant architectural decision is made, update Section 4 (Current State) and add it to relevant sections.
