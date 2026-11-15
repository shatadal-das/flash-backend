# Flash Backend

High-performance quick-commerce fashion backend built with Node.js, Express, TypeScript, raw PostgreSQL, Redis, and RustFS S3-compatible object storage.

## Prerequisites

- Node.js (v18+)
- Docker (for PostgreSQL, Redis, and RustFS)

## 1. Start Services with Docker

Run these Docker commands:

### PostgreSQL
```bash
docker run --name flash-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine
```

### Redis
```bash
docker run --name flash-redis -p 6379:6379 -d redis:7-alpine
```

### RustFS (Local S3-Compatible Object Storage)
```bash
docker run --name flash-rustfs -p 9000:9000 -p 9001:9001 \
  -e RUSTFS_ROOT_USER=admin \
  -e RUSTFS_ROOT_PASSWORD=password123 \
  -d rustfs/rustfs:latest server /data --console-address ":9001"
```

- **S3 API Endpoint**: `http://localhost:9000`
- **Web Console**: `http://localhost:9001`
- **Access Key**: `admin`
- **Secret Key**: `password123`
- **Bucket**: `flash-images` (must be created and set to public)

To stop services:
```bash
docker stop flash-postgres flash-redis flash-rustfs
```

To restart them:
```bash
docker start flash-postgres flash-redis flash-rustfs
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
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=admin
S3_SECRET_KEY=password123
S3_REGION=us-east-1
S3_BUCKET=flash-images
CLIENT_URL=http://localhost:5173
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

# Reset and recreate clean database tables with cascade constraints
npm run db:reset
```

The database schema auto-initializes on startup via `schema.ts`.

---

## Codebase Walkthrough

```
backend/src/
├── config/
│   └── env.ts              # Type-safe environment variable parsing & defaults (DB, Redis, S3)
├── database/
│   ├── pool.ts             # pg.Pool connection lifecycle management
│   ├── query.ts            # Raw SQL helpers (query, queryOne, withTransaction)
│   ├── reset.ts            # Clean table drops & schema recreation script
│   └── schema.ts           # DDL auto-migration (tables, enums, cascade FKs, indexes)
├── events/
│   ├── redis.ts            # ioredis client initialization & error handling
│   ├── channels.ts         # Redis pub/sub channel names
│   ├── cache.ts            # Redis get/set/del caching layer
│   └── broadcaster.ts      # Multi-client SSE event fanout
├── middleware/
│   ├── auth.ts             # JWT token authentication & role authorization guards
│   ├── error.ts            # Centralized AppError handling & uniform JSON response
│   ├── rate-limiter.ts     # In-memory request rate limiting
│   ├── upload.ts           # Multer memory storage middleware for file uploads
│   └── validate.ts         # Zod request body validation middleware
├── modules/
│   ├── admin/              # KPI metrics & platform-wide order oversight
│   ├── auth/               # User signup, login, refresh, profile endpoints (GET /me, PUT /profile)
│   ├── coupons/            # Promotional coupon validation & application
│   ├── delivery/           # Courier order claim & delivery state transitions
│   ├── delivery-info/      # Customer saved delivery address book
│   ├── health/             # Service health check endpoint
│   ├── orders/             # Order placement & status history
│   ├── products/           # Catalog search, filtering, and live SSE stock updates
│   ├── upload/             # S3 image upload handler (POST /api/upload)
│   └── vendor/             # Store details, address updates, multi-size product CRUD
├── storage/
│   └── s3.ts               # S3Client initialization with forcePathStyle: true
├── app.ts                  # Express app setup, CORS, Helmet & route mounting
├── server.ts               # HTTP server lifecycle & graceful shutdown
└── index.ts                # Application entrypoint
```

### Architectural Principles
- **No ORM**: Uses raw SQL via `pg` with prepared parameter binding for performance and full query control.
- **S3 Object Storage**: Uses `@aws-sdk/client-s3` configured for local RustFS (`forcePathStyle: true`), uploading image buffers from Multer memory storage and generating direct public URLs (`http://localhost:9000/flash-images/{filename}`).
- **Multi-size Inventory**: Vendor product creation accepts an array of sizes and stock quantities, stored as discrete rows.
- **Vertical Slice Architecture**: Each domain feature lives inside `src/modules/<module-name>` with its own routes, controller, service, and types.
- **Real-Time Updates**: Redis pub/sub powers Server-Sent Events (SSE) to push live stock changes to connected frontend clients.
- **Graceful Shutdown**: Automatically closes active SSE connections, Redis clients, and DB pools on `SIGINT`/`SIGTERM`.
