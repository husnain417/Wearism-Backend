# Wearism Backend API Documentation
**Version:** 1.0.0
**Base URL:** `http://localhost:3000` (Local) / `https://your-production-url.com` (Prod)

---

## Table of Contents
1. [General Integration Guidelines](#1-general-integration-guidelines)
2. [Authentication Module (Phase 1)](#2-authentication-module)
3. [User Profile Module (Phase 2)](#3-user-profile-module)
4. [Wardrobe Module (Phase 3/4)](#4-wardrobe-module)
5. [Outfits Module (Phase 3/4)](#5-outfits-module)
6. [Internal AI Service (Phase 4)](#6-internal-ai-service)
   - [Get Profile](#get-userprofile)
   - [Update Profile](#patch-userprofile)
   - [Upload Avatar](#post-userprofileavatar)
   - [Refresh Token](#post-authrefresh)
   - [Forgot Password](#post-authforgot-password)
   - [Logout](#post-authlogout)
   - [Get User Data (GDPR)](#get-authmedata)
   - [Delete Account (GDPR)](#delete-authaccount)
7. [Recommendations Module (Phase 5)](#7-recommendations-module)
8. [Social Hub (Phase 6)](#8-social-hub)
   - [Posts](#posts)
   - [Comments](#comments)
   - [Follows](#follows)
   - [Feed](#feed)
9. [Marketplace - Vendors (Phase 7)](#9-marketplace---vendors)
10. [Marketplace - Products (Phase 7)](#10-marketplace---products)
11. [Marketplace - Cart (Phase 7)](#11-marketplace---cart)
12. [Marketplace - Orders (Phase 7)](#12-marketplace---orders)

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
**Rate Limit:** 10 requests per 1 hour (per user)

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
**Rate Limit:** 20 requests per 1 hour (per user)

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

---

## 6. Internal AI Service
These endpoints are internal to the monorepo and are used by workers. They require the `X-Internal-Secret` header.

### `POST /classify/clothing`
**Auth Required:** Internal Secret (`X-Internal-Secret`)

**Request Body:**
```json
{
  "image_url": "https://...",
  "item_id": "uuid"
}
```

### `POST /rate/outfit`
**Auth Required:** Internal Secret

**Request Body:**
```json
{
  "outfit_id": "uuid",
  "items": [...],
  "user_profile": { ... }
}
```

### `POST /analyse/user`
**Auth Required:** Internal Secret

**Request Body:**
```json
{
  "image_url": "https://...",
  "user_id": "uuid"
}
```

### `POST /rate/recommendation`
**Auth Required:** Internal Secret

**Request Body:**
```json
{
  "recommendation_id": "uuid",
  "items": [...],
  "ai_result_id": "uuid",
  "user_id": "uuid"
}
```

---

## 7. Recommendations Module

### `POST /recommendations/generate`
**Auth Required:** Yes  
**Rate Limit:** 5 requests per 1 hour (per user)

Triggers the AI to generate a fresh batch of outfit combinations based on the user's available wardrobe items. Generates up to 20 combinations and queues them for AI scoring.

**Request Body:**
```json
{
  "occasion": "casual",
  "season": "all_season"
}
```
*`occasion` and `season` are optional enum filters.*

**Success Response (202 Accepted):**
```json
{
  "success": true,
  "message": "8 recommendations generated. AI scoring in progress.",
  "generated": 8,
  "recommendation_ids": ["uuid-1", "uuid-2"]
}
```
*Note: If called while fresh (< 6 hours old) recommendations exist, it will return `generated: 0` without queueing jobs. Pass `force_refresh: true` to override.*

---

### `GET /recommendations`
**Auth Required:** Yes

Returns a paginated list of recommendations for the user.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `occasion` | string | — | Filter by occasion |
| `status` | string | scored | `all`, `scored` (only rated ones), or `pending` (scoring in progress) |
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Items per page (max 20) |

**Success Response (200 OK):**
```json
{
  "success": true,
  "recommendations": [ ... ],
  "pagination": { "total": 12, "page": 1, "limit": 10, "total_pages": 2 }
}
```

---

### `GET /recommendations/:id`
**Auth Required:** Yes

Returns a specific recommendation with fully populated item details. Returns 404 if the recommendation belongs to another user.

---

### `POST /recommendations/:id/save`
**Auth Required:** Yes

Converts an AI recommendation into a persistent user Outfit. Copies the items into the `outfits` and `outfit_items` tables.

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Recommendation saved as outfit.",
  "outfit_id": "new-outfit-uuid"
}
```

---

### `DELETE /recommendations/:id/save`
**Auth Required:** Yes

Reverses the save action by setting `is_saved: false` on the recommendation. (Note: The actual outfit must be deleted via `/wardrobe/outfits/:id`).

---

### `POST /recommendations/:id/dismiss`
**Auth Required:** Yes

## 8. Social Hub

### Posts

#### `POST /posts`
**Auth Required:** Yes  
**Rate Limit:** 20 requests per 1 hour

Creates a new social post. Text content is automatically checked against the internal NSFW filter. 

**Request Body (Example):**
```json
{
  "caption": "Exploring the city in this fit ✨",
  "outfit_id": "uuid-here",
  "season": "summer",
  "visibility": "public",
  "tags": ["streetwear", "summer"]
}
```
*At least one of `caption`, `image_path`, or `outfit_id` is required. `season`, `weather`, and `visibility` must match predefined enums.*

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Post created.",
  "post": {
    "id": "uuid-here",
    "caption": "Exploring the city in this fit ✨",
    "image_url": "https://signed-url.supabase.co/..."
  }
}
```

#### `GET /posts/:id`
**Auth Required:** Yes

Retrieves a single post, including author details. Also returns `viewer_has_liked` boolean. Returns 404 if post doesn't exist, and 403 if post is `followers_only` and viewer isn't following.

#### `DELETE /posts/:id`
**Auth Required:** Yes

Soft-deletes a post you own. Automatically triggers feed invalidation so it vanishes from followers' feeds. Returns 404 if post not found or not owned.

#### `GET /posts/user/:userId`
**Auth Required:** Yes

Paginated list of a specific user's posts. Automatically hides `followers_only` posts if the viewer isn't a follower. Hidden/deleted posts are never returned.

**Params:** `page`, `limit` (max 50).

#### `POST /posts/:id/like`
**Auth Required:** Yes  
**Rate Limit:** 100 requests per 1 hour

Idempotent toggle. Will like the post if not liked, or unlike it if already liked. Returns `{ success: true, liked: true|false }`.

#### `POST /posts/:id/report`
**Auth Required:** Yes  
**Rate Limit:** 10 requests per 1 hour

Fulfills moderation requirements. Users can report posts for specific reasons (e.g., `spam`, `hate_speech`, `nudity`, `harassment`).

**Request Body:**
```json
{
  "reason": "spam",
  "detail": "Optional string describing the issue max 300 chars"
}
```

---

### Comments

#### `GET /posts/:postId/comments`
**Auth Required:** Yes

Returns a paginated list of comments on a post. Responses are structured into threads: top-level comments contain a `replies` array containing child comments. 

#### `POST /posts/:postId/comments`
**Auth Required:** Yes  
**Rate Limit:** 60 requests per 1 hour

Add a comment or reply to a post. Subject to NSFW filtering.

**Request Body:**
```json
{
  "body": "This looks incredible!",
  "parent_id": null 
}
```
*Note: To reply, provide the ID of a top-level comment in `parent_id`. Replying to a reply is blocked to prevent deep nesting.*

#### `DELETE /posts/:postId/comments/:commentId`
**Auth Required:** Yes

Soft-deletes a comment authored by the user.

---

### Follows

#### `POST /follows/:userId`
**Auth Required:** Yes

Follow another user. If you previously followed and unfollowed, this seamlessly restores the relationship rather than creating duplicate DB rows. Self-following is blocked.

**Success Response:** `{ success: true, following: true }`

#### `DELETE /follows/:userId`
**Auth Required:** Yes

Unfollow a user. 

#### `GET /follows/:userId/followers`
**Auth Required:** Yes

Paginated list of a user's followers.

#### `GET /follows/:userId/following`
**Auth Required:** Yes

Paginated list of users this user follows.

#### `GET /follows/:userId/relationship`
**Auth Required:** Yes

Check the relationship status between the authenticated viewer and the target user.

**Success Response (200 OK):**
```json
{
  "success": true,
  "you_follow_them": true,
  "they_follow_you": false,
  "mutual": false
}
```

---

### Feed

#### `GET /feed/home`
**Auth Required:** Yes

Returns a chronologically sorted, paginated feed of posts from users the authenticated user follows, plus their own posts. Backed by a high-performance Redis cache with a 30-minute TTL.

**Params:** `page`, `limit` (max 50)

**Success Response:** Returns `posts` array, `pagination` block, and a `from_cache` boolean for observability.

#### `GET /feed/trending`
**Auth Required:** Yes

Returns the top trending posts on the platform. The trending score uses a time-decay algorithm (`(likes*1.5 + comments*2 - reports*3) / (age_hours+2)^1.5`) computed offline on a schedule and cached in Redis.

**Params:** `page`, `limit` (max 50)

---

## 9. Marketplace - Vendors

### `POST /vendors/register`
**Auth Required:** Yes  
**Rate Limit:** 5 requests per 1 hour

Registers the authenticated user as a vendor. Initial status is `pending`.

**Request Body:**
```json
{
  "shop_name": "My Boutique",
  "shop_description": "Exclusive vintage collections",
  "contact_email": "shop@example.com",
  "contact_phone": "+1234567890",
  "business_address": "123 Fashion Ave"
}
```

### `GET /vendors/me`
**Auth Required:** Yes

Returns the authenticated user's vendor profile and application status (`pending`, `approved`, `suspended`).

### `PATCH /vendors/me`
**Auth Required:** Yes (Status: `approved`)

Updates vendor profile details.

### `GET /vendors/me/stats`
**Auth Required:** Yes (Status: `approved`)

Returns dashboard statistics including total revenue, total sales, and active order counts.

### `GET /vendors/:vendorId`
**Public Access:** Yes

Returns public profile of an approved vendor.

---

## 10. Marketplace - Products

### `POST /products`
**Auth Required:** Yes (Status: `approved`)  
**Rate Limit:** 50 requests per 1 hour

Creates a new product listing. Starts with `status: draft`.

**Request Body:**
```json
{
  "name": "Summer Floral Dress",
  "description": "Lightweight silk dress",
  "category": "dresses",
  "price": 85.00,
  "stock_quantity": 10,
  "condition": "new",
  "tags": ["summer", "floral", "silk"]
}
```

### `GET /products`
**Public Access:** Yes

Browse the product catalog with filters and search. Returns only `active` products with `stock_quantity > 0`.

**Query Parameters:** `page`, `limit`, `category`, `condition`, `min_price`, `max_price`, `vendor_id`, `is_resale`, `search` (full-text), `sort` (newest, price_asc, price_desc).

### `GET /products/:id`
**Public Access:** Yes

Returns full product details, including all images and public vendor info.

### `PATCH /products/:id/activate`
**Auth Required:** Yes (Owner)

Publishes a draft product to make it live in the catalog.

### `POST /products/:id/images`
**Auth Required:** Yes (Owner)

Uploads a product image. Max 6 images per product. `image_path` must start with user's ID.

### `POST /products/resale`
**Auth Required:** Yes (Status: `approved`)

Converts an existing wardrobe item into a marketplace resale listing.

---

## 11. Marketplace - Cart

### `GET /cart`
**Auth Required:** Yes

Returns current cart items, subtotal, and stock availability status. Automatically filters out items that are no longer active or in stock.

### `POST /cart/items`
**Auth Required:** Yes  
**Rate Limit:** 100 requests per 1 hour

Adds or updates an item in the cart. Self-purchase is blocked.

**Request Body:**
```json
{
  "product_id": "uuid-here",
  "quantity": 1
}
```

### `PATCH /cart/items/:id`
**Auth Required:** Yes

Updates quantity for a specific cart item.

### `DELETE /cart`
**Auth Required:** Yes

Clears the user's entire cart.

---

## 12. Marketplace - Orders

### `POST /orders`
**Auth Required:** Yes  
**Rate Limit:** 20 requests per 1 hour

Places an order from the current cart. If items belong to multiple vendors, separate orders are created automatically. Supports Cash on Delivery (COD).

**Request Body:**
```json
{
  "delivery_address": "456 Main St",
  "delivery_city": "New York",
  "delivery_phone": "+1987654321",
  "delivery_notes": "Gate code 1234"
}
```

### `GET /orders`
**Auth Required:** Yes

Returns the authenticated user's (buyer) order history.

### `GET /orders/vendor`
**Auth Required:** Yes (Status: `approved`)

Returns a list of incoming orders for the vendor. Filterable by `status`.

### `PATCH /orders/:id/confirm`
**Auth Required:** Yes (Vendor Owner)

Vendor confirms a pending order.

### `PATCH /orders/:id/ship`
**Auth Required:** Yes (Vendor Owner)

Vendor marks an order as shipped.

### `PATCH /orders/:id/deliver`
**Auth Required:** Yes (Vendor Owner)

Vendor marks an order as delivered. This automatically sets status to `completed` and flags resale items as `sold`.

### `PATCH /orders/:id/cancel`
**Auth Required:** Yes (Buyer)

Buyer cancels a `pending_confirmation` order. Restores product stock automatically.