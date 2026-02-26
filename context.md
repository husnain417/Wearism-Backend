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
│   ├── middleware/          # Shared Fastify preHandler hooks (e.g., auth guards)
│   ├── utils/               # Shared helpers (error formatting, responses)
│   └── modules/             # Feature modules (isolated)
│       ├── auth/
│       ├── user/
│       ├── wardrobe/
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

**Phase 1: Initializing Authentication - IN PROGRESS**
- Created placeholder files for the `auth` module (`auth.routes.js`, `auth.controller.js`, `auth.schema.js`, `auth.service.js`).
- Created placeholder for `authenticate.js` middleware.
- Pending logic implementation for registration, login, and JWT middleware.

## 5. Coding Guidelines for AI Agents
1. **Always use ES Modules (`import`/`export`).** Never use `require`.
2. **Never expose the `service_role` key.** Only use `src/config/supabase.js` for DB interactions on the backend.
3. **Use Fastify's built-in features.** Prefer `app.log` over `console.log`. Use Fastify schema validation instead of custom validation logic where possible.
4. **Update this document.** Whenever a new module is completed, a new plugin is added, or a significant architectural decision is made, update Section 4 (Current State) and add it to relevant sections.
