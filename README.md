# ChatNow Backend

Secure real-time chat platform backend built with **Node.js**, **Express**, **Socket.IO**, **MongoDB**, and **Brevo** transactional email.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js >= 18 |
| HTTP Framework | Express 4 |
| Real-time | Socket.IO 4 |
| Database | MongoDB 7 (Mongoose ODM) |
| Auth | JWT (access + refresh tokens) |
| Google Auth | Firebase ID token verification (custom JWKS, no Admin SDK) |
| Email | Brevo (Sendinblue) SDK |
| Security | Helmet, CORS, rate limiting, DOMPurify input sanitization |
| Logging | Winston |
| Validation | Joi |

---

## Quick Start

### Prerequisites

- Node.js >= 18
- MongoDB instance (Atlas or local)
- Brevo account (for email)
- Firebase project (for Google/email/anonymous auth)

### Installation

```bash
cd backend
npm install
```

### Environment Variables

Create `.env` in the `backend/` directory:

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/chatnow
MONGODB_DB_NAME=chatnow

# JWT
JWT_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# Firebase (Google auth)
FIREBASE_PROJECT_ID=chatnow-xxxxx

# Admin
ADMIN_EMAIL=harinarayanantr.thoovara@gmail.com

# Brevo (transactional email)
BREVO_API_KEY=<brevo-api-key>
BREVO_FROM_EMAIL=harinarayanantr.thoovara@gmail.com

# CORS
FRONTEND_URL=http://localhost:5173
SOCKET_IO_CORS_ORIGIN=http://localhost:5173

# App
NODE_ENV=development
PORT=5000
SESSION_SECRET=<random-hex>
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ROOM_ACCESS_TOKEN_EXPIRY=3600
LOG_LEVEL=info
```

### Run

```bash
npm run dev     # development (nodemon)
npm start       # production
```

---

## Architecture

```
backend/
  config/           # DB connection, Firebase config, constants
  controllers/      # Request handlers (auth, room, message, user, admin)
  middleware/        # JWT verification, admin check, validation, error handler
  models/           # Mongoose schemas (User, Room, Message, BlockedWord)
  routes/           # Express route definitions
  services/         # Business logic (JWT, bcrypt, email, cache, Firebase)
  sockets/          # Socket.IO event handlers
  utils/            # Helpers, logger
  server.js         # Entry point
```

### Startup Sequence

1. Connect to MongoDB
2. Initialize Firebase config
3. Create system rooms (`CHATNOW-ALL`, `ADMIN-CHAT`)
4. Start HTTP + Socket.IO server

---

## API Endpoints

### Auth — `/api/auth`

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/signup` | Public | — | Create account (username + password + optional email) |
| POST | `/login` | Public | 5/15min per IP | Login with username + password |
| POST | `/google` | Public | — | Login/signup with Firebase Google ID token |
| POST | `/firebase-email` | Public | — | Login/signup with Firebase email/password token |
| POST | `/anonymous` | Public | — | Login as guest via Firebase anonymous auth |
| POST | `/refresh` | Public | — | Refresh access token via httpOnly cookie |
| POST | `/logout` | Public | — | Clear refresh token cookie |

### Rooms — `/api/rooms`

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/create` | JWT | 5/hour | Create a chat room |
| POST | `/join` | JWT | — | Join a room by code (with optional password) |
| GET | `/user-rooms` | JWT | — | List user's joined rooms |
| GET | `/:roomCode/info` | JWT | — | Get room details |
| DELETE | `/:roomCode` | JWT | — | Delete own room (no system rooms) |
| PUT | `/:roomCode/password` | JWT | — | Change room password |

### Messages — `/api/messages`

| Method | Path | Auth | Rate Limit | Description |
|---|---|---|---|---|
| GET | `/:roomCode` | JWT | — | Get messages (paginated) |
| POST | `/:roomCode` | JWT | 10/sec | Send a message |
| DELETE | `/:messageId` | JWT | — | Soft-delete own message |
| PUT | `/:messageId/react` | JWT | — | Add/remove emoji reaction |

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/me` | JWT | Get current user profile |
| PUT | `/me` | JWT | Update profile (email) |
| PUT | `/me/password` | JWT | Change password |

### Admin — `/api/admin`

All admin endpoints require JWT + admin role.

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List all users |
| GET | `/users/active` | List recently active users |
| POST | `/users/ban` | Ban a user |
| POST | `/users/unban` | Unban a user |
| DELETE | `/users/:userId` | Delete a user account |
| POST | `/users/flag` | Flag and ban a user |
| DELETE | `/messages/:messageId` | Delete any message |
| DELETE | `/messages/clear/:roomCode` | Clear all messages in a room |
| POST | `/blocked-words` | Add a blocked word |
| GET | `/blocked-words` | List blocked words |
| DELETE | `/blocked-words/:wordId` | Remove a blocked word |
| POST | `/add-admin` | Promote user to admin (main admin only) |
| DELETE | `/remove-admin/:userId` | Demote admin (main admin only) |
| POST | `/reset` | Reset entire platform (main admin only) |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check → `{ status: "ok", timestamp }` |

---

## Database Models

### User

| Field | Type | Notes |
|---|---|---|
| `username` | String | unique, 3-20 chars, lowercase |
| `email` | String | unique (sparse), optional |
| `passwordHash` | String | bcrypt |
| `firebaseUID` | String | unique (sparse), for Firebase-linked accounts |
| `joinedRooms` | [String] | room codes the user has joined |
| `lastActive` | Date | |
| `bannedStatus` | `{ isBanned, bannedAt, bannedBy, reason }` | |
| `isAdmin` | Boolean | |

### Room

| Field | Type | Notes |
|---|---|---|
| `roomCode` | String | unique, uppercase (e.g. `CHATNOW-ALL`) |
| `name` | String | 1-50 chars |
| `passwordHash` | String | null = no password |
| `createdBy` | ObjectId (User) | |
| `members` | [ObjectId (User)] | |
| `isDeleted` | Boolean | soft delete |

### Message

| Field | Type | Notes |
|---|---|---|
| `roomCode` | String | indexed |
| `sender` | `{ userId, username }` | |
| `content` | String | max 5000, null if deleted |
| `contentType` | `text \| image \| file` | |
| `deletedAt` | Date | null = not deleted |
| `reactions` | `[{ emoji, users }]` | |

### BlockedWord

| Field | Type | Notes |
|---|---|---|
| `word` | String | unique, lowercase |
| `addedBy` | ObjectId (User) | |

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `room:join` | `roomCode` | Join a socket room |
| `room:leave` | `roomCode` | Leave a socket room |
| `message:send` | `{ roomCode, content, contentType }` | Send a message |
| `message:delete` | `{ messageId, roomCode }` | Delete own message |
| `message:typing` | `{ roomCode, isTyping }` | Typing indicator |
| `room:members` | `roomCode` | Request online members |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `message:new` | full message object | New message in subscribed room |
| `message:deleted` | `{ messageId, roomCode }` | Message deleted |
| `user:joined` | `{ userId, username, roomCode }` | User entered room |
| `user:left` | `{ userId, username, roomCode }` | User left room |
| `user:typing` | `{ userId, username, isTyping, roomCode }` | Typing status |
| `room:members` | `{ roomCode, members }` | Online member list |
| `account:banned` | `{ reason }` | User has been banned |
| `account:flagged` | `{ reason }` | User has been flagged |
| `room:messages-cleared` | `{ roomCode }` | Room messages cleared |
| `platform:reset` | `{ resetBy }` | Platform reset |
| `blocked-words:updated` | — | Blocked words list changed |

---

## Authentication Flow

1. User signs up/logs in → server returns **access token** (1h) and **refresh token** (7d, httpOnly cookie)
2. Client sends access token via `Authorization: Bearer <token>` header
3. When access expires, client calls `POST /api/auth/refresh` with the refresh cookie
4. Server issues new token pair

### Admin Detection

- Main admin: email matches `ADMIN_EMAIL` env var (hardcoded fallback: `harinarayanantr.thoovara@gmail.com`)
- Additional admins: `isAdmin: true` flag on User doc, set via `/api/admin/add-admin`
- Checked at auth time and on every admin API call via `verifyAdmin` middleware

### Firebase Auth (No Admin SDK)

Firebase ID tokens are verified using Google's public JWKS endpoint (`securetoken@system.gserviceaccount.com`) with the standard `jsonwebtoken` library. No Firebase Admin SDK is used.

---

## Room Isolation

System rooms are defined in `ADMIN_ROOMS = ['ADMIN-CHAT']`:

- `ADMIN-CHAT` is **hidden** from non-admin users at every layer:
  - Not returned in `getUserRooms` for non-admins
  - Blocked from the `joinRoom` API (auto-joined for admins only)
  - Socket `room:join` rejected for non-admins
  - `message:send` socket handler checks admin role
  - Message REST endpoints check admin role before serving
- `CHATNOW-ALL` is the global public room, auto-joined for every user

---

## Security

| Measure | Implementation |
|---|---|
| XSS prevention | DOMPurify on all user input |
| CSP headers | Helmet middleware |
| Rate limiting | express-rate-limit (login, room creation, messages) |
| Password hashing | bcrypt, 12 salt rounds |
| Token auth | JWT with short-lived access + long-lived refresh |
| Refresh tokens | httpOnly, Secure, SameSite cookies |
| Request size limit | 10kb JSON/URL-encoded body limit |
| Input validation | Joi schemas on all mutation endpoints |
| CORS | Origin-restricted to FRONTEND_URL |
| Soft deletes | Messages/rooms are soft-deleted, never destroyed |

---

## Deployment

The backend is designed for **Render** (or any Node.js hosting).

1. Set all env vars in the Render dashboard
2. Ensure `NODE_ENV=production`
3. The server starts on `process.env.PORT || 5000`

---

## Email (Brevo)

Triggered on auth events:

| Event | Email | Recipient |
|---|---|---|
| User signup | Welcome email with platform info | User's email |
| User login | Login notification (device, IP, timestamp) | User's email |

Emails are fire-and-forget (no `await`) to avoid delaying auth responses. Requires `BREVO_API_KEY` env var.
