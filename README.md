# Flash Backend

High-performance quick-commerce fashion backend built with Node.js, Express, TypeScript, raw PostgreSQL, and Redis.

## Prerequisites

- Node.js (v18+)
- Docker (for PostgreSQL & Redis)

## 1. Start PostgreSQL & Redis with Docker

Run these two simple Docker commands:

### PostgreSQL
```bash
docker run --name flash-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine
```

### Redis
```bash
docker run --name flash-redis -p 6379:6379 -d redis:7-alpine
```

To stop them later:
```bash
docker stop flash-postgres flash-redis
```

To restart them:
```bash
docker start flash-postgres flash-redis
```

## 2. Environment Variables

Create `.env` in the `backend/` folder:

```env
PORT=3000
NODE_ENV=development
POSTGRES_URI=postgresql://postgres:postgres@localhost:5432/postgres
REDIS_URI=redis://localhost:6379
JWT_ACCESS_SECRET=your_jwt_access_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
```

## 3. Install & Run

```bash
cd backend

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start production server
npm start

# Or run development mode with live watch
npm run dev
```

The database schema and tables auto-initialize on startup via `schema.ts`.

---

## Codebase Walkthrough

```
backend/src/
├── config/
│   └── env.ts              # Type-safe environment variable parsing & defaults
├── database/
│   ├── pool.ts             # pg.Pool connection lifecycle management
│   ├── query.ts            # Raw SQL helpers (query, queryOne, withTransaction)
│   └── schema.ts           # DDL auto-migration (tables, enums, indexes, triggers)
├── events/
│   ├── redis.ts            # ioredis client initialization & error handling
│   ├── channels.ts         # Redis pub/sub channel names
│   ├── cache.ts            # Redis get/set/del caching layer
│   └── broadcaster.ts      # Multi-client SSE event fanout
├── middleware/
│   ├── auth.ts             # JWT token authentication & role authorization guards
│   ├── error.ts            # Centralized AppError handling & uniform JSON response
│   ├── rate-limiter.ts     # In-memory request rate limiting
│   └── validate.ts         # Zod request body validation middleware
├── modules/
│   ├── admin/              # KPI metrics & platform-wide order oversight
│   ├── auth/               # User signup, login, refresh tokens, logout
│   ├── coupons/            # Promotional coupon validation & application
│   ├── delivery/           # Courier order claim & delivery state transitions
│   ├── delivery-info/      # Customer saved delivery address book
│   ├── health/             # Service health check endpoint
│   ├── orders/             # Order placement & status history
│   ├── products/           # Catalog search, filtering, and live SSE stock updates
│   └── vendor/             # Store management & vendor product inventory CRUD
├── app.ts                  # Express app setup, CORS, Helmet & route mounting
├── server.ts               # HTTP server lifecycle & graceful shutdown
└── index.ts                # Application entrypoint
```

### Architectural Principles
- **No ORM**: Uses raw SQL via `pg` with prepared parameter binding for performance and full query control.
- **Vertical Slice Architecture**: Each domain feature lives inside `src/modules/<module-name>` with its own routes, controller, service, and types.
- **Real-Time Updates**: Redis pub/sub powers Server-Sent Events (SSE) to push live stock changes to connected frontend clients.
- **Graceful Shutdown**: Automatically closes active SSE connections, Redis clients, and DB pools on `SIGINT`/`SIGTERM`.

