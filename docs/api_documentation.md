# Wearism Backend API Documentation
**Version:** 1.0.0
**Base URL:** `http://localhost:3000` (Local) / `https://your-production-url.com` (Prod)

---

## Table of Contents
1. [General Integration Guidelines](#1-general-integration-guidelines)
2. [Authentication Module (Phase 1)](#2-authentication-module)
   - [Signup](#post-authsignup)
   - [Login](#post-authlogin)
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
