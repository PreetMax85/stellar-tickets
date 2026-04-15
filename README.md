# 🎬 Stellar Tickets – Chai Code Hackathon 2026

A modern, secure, and REST-compliant movie theater seat booking platform — built by extending the [starter codebase](https://github.com/chaicodehq/book-my-ticket) into a robust, enterprise-grade monolith with JWT authentication, atomic seat booking, and a polished BookMyShow-inspired frontend.

> **⚠️ Note for Judges (Render Deployment):** This project is hosted on Render's free tier. The server sleeps after 15 minutes of inactivity. **The live link may take up to 50 seconds to wake up on first visit.** Please be patient — it's worth the wait!

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js with **TypeScript** |
| Backend | Express.js 5.0 |
| Database | PostgreSQL (Neon DB) with Drizzle ORM |
| Validation | Zod (type-safe schema validation) |
| Authentication | JWT (access + refresh tokens) + bcrypt + cookie-parser |
| Frontend | Vanilla HTML5, Tailwind CSS (CDN), Vanilla JS (ES6+ SPA) |

---

## 🏗️ Project Architecture

```
src/
├── common/
│   ├── config/
│   │   └── env.ts                  # Zod-validated environment config — crashes fast if secrets are missing
│   ├── constants/
│   │   └── httpStatus.ts           # Named HTTP status constants (no magic numbers)
│   ├── db/
│   │   ├── index.ts                # pg Pool with keepAlive + graceful SIGTERM shutdown
│   │   ├── schema.ts               # Drizzle ORM table definitions + partial unique index
│   │   ├── seed.ts                 # Seeds 10 movies + 60 seats (safe to re-run)
│   │   └── migrations/             # Auto-generated Drizzle migration files
│   ├── middleware/
│   │   ├── authenticate.middleware.ts  # JWT Bearer guard — attaches req.user
│   │   └── error.middleware.ts         # Global error handler (Zod + ApiError + PG codes)
│   └── utils/
│       ├── ApiError.ts             # Custom error class with static factory methods
│       ├── ApiResponse.ts          # Consistent JSON response envelope
│       └── jwt.ts                  # Token generation + verification with type-claim protection
├── modules/
│   ├── auth/
│   │   ├── dtos/auth.dto.ts        # Zod schemas for all auth payloads
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   └── auth.routes.ts
│   ├── booking/
│   │   ├── dtos/booking.dto.ts     # Zod schemas for book + cancel
│   │   ├── booking.controller.ts
│   │   ├── booking.service.ts
│   │   ├── booking.repository.ts   # Atomic transactions + typed BookingError constants
│   │   └── booking.routes.ts
│   └── movies/
│       ├── movies.repository.ts
│       └── movies.routes.ts
├── index.ts                        # Express app entry point
public/
├── index.html                      # SPA shell
├── app.js                          # Vanilla JS: state, fetch wrapper, seat grid renderer
├── images                          # Movie Posters
```

---

## 🔁 User Flow

1. **Register** → `POST /api/auth/register` with `{ name, email, password }` → auto logged-in
2. **Login** → `POST /api/auth/login` with `{ email, password }` → receive `accessToken`
3. **Browse seats** → `GET /api/bookings/seats` — public, no token needed
4. **Book a seat** → `POST /api/bookings/book` with `{ seatId, movieId }` + Bearer token
5. **View my bookings** → `GET /api/bookings/my-bookings` + Bearer token
6. **Cancel a booking** → `POST /api/bookings/cancel` with `{ bookingId }` + Bearer token
7. **Forgot password** → `POST /api/auth/forgot-password` with `{ email }`
8. **Reset password** → `POST /api/auth/reset-password` with `{ token, newPassword }`
9. **Logout** → `POST` `/api/auth/logout` -> clears HttpOnly refresh cookie

---

## 📊 Database Schema

```mermaid
erDiagram
    users {
        serial id PK
        varchar name
        varchar email UK
        varchar password
        varchar reset_token
        timestamp reset_token_expires_at
        timestamp created_at
        timestamp updated_at
    }

    movies {
        serial id PK
        varchar title UK
        varchar language
        int duration
        varchar poster_url
        timestamp created_at
    }

    seats {
        serial id PK
        varchar name
        int isbooked
        int user_id FK
        timestamp booked_at
        timestamp updated_at
    }

    bookings {
        serial id PK
        int user_id FK
        int seat_id FK
        int movie_id FK
        varchar status
        timestamp booked_at
    }

    users ||--o{ seats     : "books"
    users ||--o{ bookings  : "has"
    seats ||--o{ bookings  : "referenced in"
    movies ||--o{ bookings : "featured in"
```

---

## 🎟️ Booking Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant MW as Auth Middleware
    participant API as BookingService
    participant DB as PostgreSQL (Neon)

    U->>API: POST /api/auth/login
    API-->>U: { accessToken } + refreshToken (HttpOnly cookie)

    U->>API: GET /api/bookings/seats (public)
    API->>DB: SELECT * FROM seats ORDER BY id
    API-->>U: Array of 60 seats with isBooked status

    U->>MW: POST /api/bookings/book (Bearer token)
    MW->>MW: verifyAccessToken → attach req.user
    MW->>API: userId extracted from JWT payload

    API->>DB: BEGIN TRANSACTION
    DB->>DB: UPDATE seats SET isBooked=1<br/>WHERE id=seatId AND isBooked=0
    Note over DB: WHERE isBooked=0 — only one concurrent UPDATE wins.
    DB->>DB: INSERT INTO bookings (userId, seatId, movieId, 'confirmed')
    DB-->>API: COMMIT → { seat, booking }
    API-->>U: 201 Created — seat turns amber in UI

    U->>MW: POST /api/bookings/cancel (Bearer token)
    MW->>API: userId from JWT
    API->>DB: BEGIN TRANSACTION
    DB->>DB: UPDATE bookings SET status='cancelled'<br/>WHERE id=bookingId AND userId=? AND status='confirmed'
    DB->>DB: UPDATE seats SET isBooked=0, userId=null
    DB-->>API: COMMIT
    API-->>U: 200 OK — seat turns green in UI
```

---

## 🏛️ Architectural Highlights

### 1. Three-Layer Architecture (Controller → Service → Repository)

Every module is split into three strict layers:

- **Routes** — HTTP verb and path mapping only
- **Controllers** — Extract and validate request data (`req.body`, `req.user`), call services, return responses
- **Services + Repositories** — Pure business logic and database access, fully decoupled from Express

### 2. Atomic Transactions — Zero Double-Bookings

The booking transaction uses a conditional `UPDATE ... WHERE isBooked = 0` as an atomic lock. When two users race to book the same seat, PostgreSQL guarantees only one `UPDATE` succeeds. The loser gets a `SEAT_UNAVAILABLE` error cleanly, with no phantom bookings and no race conditions.

### 3. Partial Unique Index — Cancellation Support

The `bookings` table has a **partial unique index** on `(seatId, movieId) WHERE status = 'confirmed'`. This means:

- Two confirmed bookings for the same seat and movie are **impossible at the database level**
- Cancelled bookings are **excluded from the constraint**, so a seat can be re-booked after cancellation without violating the index

### 4. Token Type Claims — Confusion Attack Prevention

Every JWT includes a `type` claim (`"access"` or `"refresh"`). The verify functions check this claim explicitly — a refresh token passed to a protected endpoint is rejected even if the signature is valid.

### 5. Startup Validation — Fast Failure

Both `env.ts` (Zod) and `db/index.ts` (pg pool) validate their configuration at startup and throw immediately if anything is missing or wrong. The server refuses to start with a broken config rather than failing silently on the first request.

### 6. Graceful Shutdown

The DB pool listens for `SIGTERM` (sent by Render and Railway before killing a process) and cleanly closes all connections, allowing in-flight transactions to complete before exit.

---

## 🔐 Security

- Passwords hashed with **bcrypt** before storage — plaintext never touches the database
- Access tokens are **short-lived (15m)** and refreshed silently via an **HttpOnly cookie** — the browser sends the refresh cookie automatically with no JS access
- JWT secrets are validated to be **at least 32 characters** at startup
- Auth error messages are intentionally **identical** for wrong email and wrong password — prevents user enumeration
- Forgot password always returns the **same response** whether the email exists or not — same reason
- All request bodies are validated with **Zod** before reaching service logic
- Auth endpoints protected with **express-rate-limit** (10 requests / 15 min per IP) — brute force protection on login, forgot-password, and reset-password

---

## 🔄 Evolution from Starter Code

The starter codebase provided a working foundation with a flat structure and a simple seat booking endpoint. This submission extends it with a full authentication system, multi-layer architecture, and a production-ready approach — while preserving the core spirit of the original.

| Starter | This Submission |
|---|---|
| `GET /seats` — flat array | `GET /api/bookings/seats` — same data, consistent `/api/*` prefix |
| `PUT /:id/:name` — identity via URL param | `POST /api/bookings/book` — identity from verified JWT, no client trust |
| No user accounts | Full register/login/refresh/forgot-password flow |
| No booking history | `bookings` table with status tracking and cancellation support |
| Single flat file | Controller → Service → Repository across three modules |

---

## 🛣️ API Reference

### Public Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/api/movies` | All movies |
| `GET` | `/api/bookings/seats` | All 60 seats with availability |

### Auth Routes

| Method | Endpoint | Body |
|---|---|---|
| `POST` | `/api/auth/register` | `{ name, email, password }` |
| `POST` | `/api/auth/login` | `{ email, password }` |
| `POST` | `/api/auth/refresh` | _(refreshToken via HttpOnly cookie)_ |
| `POST` | `/api/auth/forgot-password` | `{ email }` |
| `POST` | `/api/auth/reset-password` | `{ token, newPassword }` |
| `POST` | `/api/auth/logout` | _(clears HttpOnly refresh cookie)_ |

**Response shape (register & login):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": 1, "name": "John", "email": "john@example.com" },
    "accessToken": "eyJ..."
  }
}
```

### Protected Routes
> Require `Authorization: Bearer <accessToken>` header

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/api/bookings/my-bookings` | — | Current user's booking history |
| `POST` | `/api/bookings/book` | `{ seatId, movieId }` | Book a seat atomically |
| `POST` | `/api/bookings/cancel` | `{ bookingId }` | Cancel a confirmed booking |

---

## 💻 Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/PreetMax85/stellar-tickets.git
cd stellar-tickets
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Neon database

[Neon](https://neon.tech) is a free serverless PostgreSQL provider. Here's how to get your database URL:

1. Go to [neon.tech](https://neon.tech) and sign up for free
2. Click **New Project** → enter a name → select your region → choose PostgreSQL 17 → click **Create**
3. In your project dashboard, click **Connection String**
4. Make sure **Connection pooling** is enabled
5. Copy the connection string — it looks like this:
   ```
   postgresql://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 4. Set up environment variables

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Then open `.env` and fill in your values:

```dotenv
# Server
PORT=8080
NODE_ENV=development
APP_URL="http://localhost:8080"

# Database — paste your Neon connection string here
DATABASE_URL="postgresql://username:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# JWT — must be different strings, minimum 32 characters each

JWT_ACCESS_SECRET="replace_with_a_long_random_string_minimum_32_chars"
JWT_REFRESH_SECRET="replace_with_a_different_long_random_string_minimum_32_chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

> **Tip:** Generate strong secrets by running this command twice (use each output for one secret):
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 5. Initialize the database

```bash
# Generate migration files from schema
npx drizzle-kit generate

# Apply migrations to your Neon database
npx drizzle-kit migrate

# Seed 10 movies + 60 seats (safe to re-run)
npm run seed
```

### 6. Start the development server

```bash
npm run dev   # starts with hot-reload — auto-restarts on file changes
```

Open [http://localhost:8080](http://localhost:8080) in your browser. You should see the theater interface with the movie selector and 60 available seats.