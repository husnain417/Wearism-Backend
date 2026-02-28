# Wearism Backend Context

## 1. Project Overview
Wearism is a modern backend application. This document serves as the primary source of truth for AI agents working on this codebase, providing architectural guidelines, current state, and conventions. 

## 2. Technology Stack
- **Runtime Environment:** Node.js (v20+ target)
- **Module System:** ES Modules (`"type": "module"` in `package.json`)
- **API Framework:** Fastify (v5)
- **Validation:** JSON Schema (via Fastify serialization)
- **Database & Auth:** Supabase (PostgreSQL)
  - using `@supabase/supabase-js`
  - Client configured in `src/config/supabase.js` using `SERVICE_ROLE_KEY`
- **Environment Management:** `@fastify/env` with JSON Schema validation (`src/config/env.js`)
- **Logging:** Pino (built into Fastify) with `pino-pretty` for development
- **Security:** `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`
- **Authentication Strategy:** JWT via `@fastify/jwt` (and Supabase Auth)
- **Linting & Formatting:** ESLint (v9) + Prettier

## 3. Architecture & Folder Structure
The codebase follows a modular, feature-based architecture to keep concerns isolated:

```
wearism-backend/
├── src/
│   ├── app.js               # Fastify app factory setup
│   ├── config/              # Centralized configuration (env, supabase)
│   ├── plugins/             # Fastify plugins (db, auth hooks)
│   ├── middleware/          # Shared Fastify preHandler hooks (auth, UUID validation)
│   ├── services/            # External service clients (AI service HTTP client)
│   ├── workers/             # Background job processors (classification worker)
│   ├── utils/               # Shared helpers (imageProcessor, error formatting)
│   └── modules/             # Feature modules (isolated)
│       ├── auth/
│       ├── user/
│       ├── wardrobe/        # Items + Outfits
│       ├── ai/
│       ├── recommendations/
│       ├── social/
│       └── marketplace/
├── server.js                # Entry point
└── .env                     # Local environment variables
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

**Phase 3: Wardrobe Module & AI Integration - COMPLETED**
- [x] Implemented wardrobe item CRUD with Fastify JSON Schema validation (`wardrobe.schema.js`).
- [x] `wardrobeService` with image path ownership validation, 500-item size cap, signed URL generation, soft delete + storage cleanup.
- [x] Outfit CRUD with junction table management (`outfit_items`), item ownership validation on create/update.
- [x] AI service HTTP client (`aiService.js`) with 30s timeout and AbortController.
- [x] Classification worker (`classificationWorker.js`) polling `ai_results` every 5s for pending jobs.
- [x] UUID validation middleware (`validateUUID.js`) on all `:id` param routes.
- [x] Rate limiting: 30 items/10min on wardrobe creation, 20 outfits/10min on outfit creation.
- [x] GDPR: `deleteAllUserItems` wired into `auth.service.js` `deleteAccount` for bulk storage erasure.
- [x] Registered `/wardrobe` and `/wardrobe/outfits` routes in `app.js`.
- [x] 28 Jest tests passing across wardrobe and outfit endpoints.

## 5. Coding Guidelines for AI Agents
1. **Always use ES Modules (`import`/`export`).** Never use `require`.
2. **Never expose the `service_role` key.** Only use `src/config/supabase.js` for DB interactions on the backend.
3. **Use Fastify's built-in features.** Prefer `app.log` over `console.log`. Use Fastify schema validation instead of custom validation logic where possible.
4. **Update this document.** Whenever a new module is completed, a new plugin is added, or a significant architectural decision is made, update Section 4 (Current State) and add it to relevant sections.
