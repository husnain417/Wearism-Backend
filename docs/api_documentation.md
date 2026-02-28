# Wearism Backend API Documentation
**Version:** 1.0.0
**Base URL:** `http://localhost:3000` (Local) / `https://your-production-url.com` (Prod)

---

## Table of Contents
1. [General Integration Guidelines](#1-general-integration-guidelines)
2. [Authentication Module (Phase 1)](#2-authentication-module)
3. [User Profile Module (Phase 2)](#3-user-profile-module)
4. [Wardrobe Module (Phase 3)](#4-wardrobe-module)
5. [Outfits Module (Phase 3)](#5-outfits-module)
   - [Get Profile](#get-userprofile)
   - [Update Profile](#patch-userprofile)
   - [Upload Avatar](#post-userprofileavatar)
   - [Refresh Token](#post-authrefresh)
   - [Forgot Password](#post-authforgot-password)
   - [Logout](#post-authlogout)
   - [Get User Data (GDPR)](#get-authmedata)
   - [Delete Account (GDPR)](#delete-authaccount)

---

## 1. General Integration Guidelines

### 1.1 Content Types
All API endpoints expect the request body to be `application/json` unless otherwise specified.
```http
Content-Type: application/json
```

### 1.2 Authorization Strategy
Wearism uses **JWT (JSON Web Tokens)**. 
When a user logs in or signs up, you will receive an `access_token` and a `refresh_token`.

1. **Access Token:** Short-lived (usually ~1 hour). Must be sent in the `Authorization` header of every protected API request:
   ```http
   Authorization: Bearer <access_token>
   ```
2. **Refresh Token:** Long-lived. Store this securely on the device (e.g., Secure Store in React Native or HttpOnly cookies). When the `access_token` expires (the server returns a `401 Unauthorized`), call the `/auth/refresh` endpoint to get a new pair invisibly to the user.

### 1.3 Response Format
All successful responses are structured with a `success: true` wrapper:
```json
{
  "success": true,
  "data": { ... } // or "user", "session", "message"
}
```

Error responses (4xx, 5xx):
```json
{
  "success": false,
  "error": "Human readable error message"
}
```

---

## 2. Authentication Module

### `POST /auth/signup`
Creates a new user account. GDPR consent is strictly required.

**Rate Limit:** 3 requests per 15 minutes per IP.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "gdpr_consent": true
}
```
*Note: `password` must be at least 8 characters. `gdpr_consent` MUST be boolean `true`.*

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Account created. Please verify your email.",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com"
  },
  "session": null // Or session object if email verification is disabled
}
```

**Frontend Integration Note:** By default, Supabase requires email verification. The user must click the link sent to their email before they can successfully `login`.

---

### `POST /auth/login`
Authenticates a user and returns session tokens.

**Rate Limit:** 5 requests per 15 minutes per IP.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "eyJhbG...",
    "refresh_token": "refresh-token-here",
    "expires_in": 3600
  }
}
```

**Frontend Integration Note:** Store both tokens. Immediately attach `access_token` to your API client's default headers.

---

### `POST /auth/refresh`
Exchanges a valid refresh token for a brand new access and refresh token.

**Request Body:**
```json
{
  "refresh_token": "your-saved-refresh-token"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "access_token": "new-eyJhbG...",
    "refresh_token": "new-refresh-token-here",
    "expires_in": 3600
  }
}
```

**Frontend Integration Note:** Setup an Axios/Fetch interceptor. If any API call returns `401 Unauthorized`, pause the queue, call this endpoint, update your stored tokens, and replay the queued API calls.

---

### `POST /auth/forgot-password`
Sends a password reset email. 

**Rate Limit:** 3 requests per 1 hour per IP.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "If that email exists, a reset link has been sent."
}
```
*Security Note: To prevent user enumeration attacks, this endpoint always returns a success message even if the email does not exist in the database.*

---

### `POST /auth/logout`
**Auth Required:** Yes (`Authorization: Bearer <token>`)

Invalidates the current session on the backend.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

### `GET /auth/me/data`
**Auth Required:** Yes (`Authorization: Bearer <token>`)

Fulfills **GDPR Article 15 (Right to Access)**. Returns the complete profile data record that Wearism holds about the currently authenticated user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": null,
    "height_cm": null,
    "weight_kg": null,
    "gdpr_consent": true,
    "gdpr_consent_date": "2023-10-01T12:00:00Z",
    "created_at": "2023-10-01T12:00:00Z"
  }
}
```

---

### `DELETE /auth/account`
**Auth Required:** Yes (`Authorization: Bearer <token>`)

Fulfills **GDPR Article 17 (Right to Erasure)**. Performs a secure deletion of the user request. 
1. Flags the user's profile with a soft-delete `deleted_at` timestamp.
2. Removes the user from the Supabase Authentication system.
3. Automatically rejects any further API requests made with existing tokens.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Your account and all associated data have been deleted."
}
```

**Frontend Integration Note:** Calling this should immediately clear the user's local tokens and route them back to the welcome/login screen.

---

## 3. User Profile Module

### `GET /user/profile`
**Auth Required:** Yes (`Authorization: Bearer <token>`)

Retrieves the authenticated user's profile and returns a dynamically calculated completion score.

**Success Response (200 OK):**
```json
{
  "success": true,
  "profile": {
    "id": "uuid-here",
    "email": "user@example.com",
    "full_name": null,
    "avatar_url": null,
    "gender": null,
    ... // see update schema for fields
  },
  "completion_score": 14 
}
```
*Note: The completion score maxes out at 100 and is intended to be used on the frontend to drive a progress bar encouraging users to fill out their profile.*

---

### `PATCH /user/profile`
**Auth Required:** Yes (`Authorization: Bearer <token>`)

Perform a partial update on the user's profile. Strict enum validation is mapped exactly to GDPR Data Minimisation standards. All fields are optional.

**Request Body (Example):**
```json
{
  "full_name": "Test User",
  "gender": "prefer_not_to_say",
  "age_range": "25-34",
  "height_cm": 180,
  "weight_kg": 75.5,
  "body_type": "athletic",
  "skin_tone": "olive"
}
```

**Validations:**
1. `gender`: `['male', 'female', 'non_binary', 'prefer_not_to_say']`
2. `age_range`: `['13-17', '18-24', '25-34', '35-44', '45-54', '55+']`
3. `height_cm`: 100 - 250
4. `weight_kg`: 30 - 300
5. `body_type`: `['slim', 'athletic', 'average', 'curvy', 'plus_size']`
6. `skin_tone`: `['fair', 'light', 'medium', 'olive', 'brown', 'dark']`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "profile": { ...updatedProfileData }
}
```

---

### `POST /user/profile/avatar`
**Auth Required:** Yes (`Authorization: Bearer <token>`)

Upload a raw profile image directly from the mobile phone buffer. The backend compresses this image entirely automatically via `sharp` and stores a < 50kb `.webp` variant, returning a 365-day signed Supabase Storage URL.

**Headers:**
```http
Content-Type: multipart/form-data
```
**Form Data Payload:**
- `file`: The image file (JPEG, PNG, WebP, HEIC). Max size 5MB.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Avatar uploaded successfully.",
  "avatar_url": "https://<supabase-id>.supabase.co/storage/v1/object/sign/avatars/..."
}
```
*Note: The endpoint uses `upsert: true`. You do not need to delete old avatars—the new upload will automatically overwrite them entirely in storage and sync the URL to the profile DB.*

---

## 4. Wardrobe Module

### `POST /wardrobe/items`
**Auth Required:** Yes  
**Rate Limit:** 30 requests per 10 minutes

Creates a new wardrobe item and queues an AI clothing classification job.

**Request Body:**
```json
{
  "item_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_path": "<user_id>/550e8400.webp",
  "name": "Blue Denim Jacket",
  "brand": "Levi's",
  "category": "outerwear",
  "condition": "good"
}
```
*`item_id` (UUID) and `image_path` are required. `category` enum: tops, bottoms, dresses, outerwear, footwear, accessories, activewear, swimwear, underwear, sleepwear.*

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Item added. AI classification in progress.",
  "item": { ...itemData },
  "ai_status": "pending"
}
```
**Security:** `image_path` must start with the authenticated user's ID. Max 500 items per user.

---

### `GET /wardrobe/items`
**Auth Required:** Yes

Returns a paginated, filterable list of wardrobe items.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | — | Filter by category |
| `season` | string | — | Filter by season |
| `is_favourite` | boolean | — | Filter favourites |
| `is_for_sale` | boolean | — | Filter items for sale |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 50) |

**Success Response (200 OK):**
```json
{
  "success": true,
  "items": [ ...items ],
  "pagination": { "total": 42, "page": 1, "limit": 20, "total_pages": 3 }
}
```

---

### `GET /wardrobe/items/:id`
**Auth Required:** Yes

Returns a single wardrobe item. Returns 404 if item is from another user (no information leak).

---

### `PATCH /wardrobe/items/:id`
**Auth Required:** Yes

Partial update. Accepts: `name`, `brand`, `category`, `subcategory`, `colors` (array), `pattern`, `fit` (slim/regular/relaxed/oversized), `season`, `condition`, `purchase_price`, `is_favourite`, `is_for_sale`, `resale_price`.

---

### `DELETE /wardrobe/items/:id`
**Auth Required:** Yes

Soft-deletes the item and removes the image from Supabase Storage.

---

### `POST /wardrobe/items/:id/worn`
**Auth Required:** Yes

Increments `times_worn` and records `last_worn_at`. Returns `{ times_worn, last_worn_at }`.

---

### `GET /wardrobe/items/:id/ai-status`
**Auth Required:** Yes

Poll this endpoint to check AI classification progress.

**Success Response (200 OK):**
```json
{
  "success": true,
  "ai": {
    "status": "completed",
    "result": { "category": "tops", "colors": ["blue"], ... },
    "processing_time_ms": 1234
  }
}
```
*Possible `status` values: `pending`, `processing`, `completed`, `failed`.*

---

## 5. Outfits Module

### `POST /wardrobe/outfits`
**Auth Required:** Yes  
**Rate Limit:** 20 requests per 10 minutes

Creates an outfit from wardrobe items and queues an AI rating job.

**Request Body:**
```json
{
  "name": "Monday Office Look",
  "occasion": "business_casual",
  "item_ids": ["<item_uuid_1>", "<item_uuid_2>"],
  "status": "saved"
}
```
*`item_ids` required (1–20 UUIDs). `occasion` enum: casual, business_casual, formal, athletic, outdoor, beach, evening, date_night. `status` enum: draft, saved, published.*

**Security:** All `item_ids` must belong to the authenticated user. Returns 403 otherwise.

---

### `GET /wardrobe/outfits`
**Auth Required:** Yes

Paginated list with optional `occasion` and `status` filters.

---

### `GET /wardrobe/outfits/:id`
**Auth Required:** Yes

Returns outfit with nested wardrobe items (id, name, image_url, category, subcategory, colors).

---

### `PATCH /wardrobe/outfits/:id`
**Auth Required:** Yes

Update outfit metadata and/or replace item list. If `item_ids` provided, all must belong to the user.

---

### `DELETE /wardrobe/outfits/:id`
**Auth Required:** Yes

Soft-deletes the outfit. Junction records cascade-deleted via FK.
