# Flash Backend - Production Deployment Guide

## 1. Quick Start via Docker Compose (Turnkey Stack)

To run the complete production backend (API + PostgreSQL + Redis):

```bash
# 1. Copy and populate production secrets
cp .env.example .env.production
# Edit .env.production with strong JWT secrets:
# openssl rand -hex 32

# 2. Build and launch all services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Check logs and health
docker compose -f docker-compose.prod.yml logs -f api
curl -f http://localhost:3000/api/health
```

---

## 2. Bare-Metal / Cloud VM Deployment (Node.js 20+)

### Step 1: Install & Build
```bash
npm ci --omit=dev
# Build standalone production bundle
npm run build
```

### Step 2: Database Setup & Migration
Ensure your PostgreSQL database is reachable via `DATABASE_URL`:
```bash
npm run prisma:migrate:run
```

### Step 3: Run via Process Manager (PM2 / Systemd)
```bash
# PM2 process execution
pm2 start dist/index.js --name "flash-api" -i max
pm2 save
pm2 startup
```

---

## 3. Managed Cloud Platforms (Railway / Render / Fly.io / AWS ECS)

### Build Command:
```bash
npm run build
```

### Start Command:
```bash
npm start
```
*(Executes `node dist/index.js`)*

### Required Environment Variables:
| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment flag | `production` |
| `PORT` | Listening port | `3000` (or provided by host) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `REDIS_URI` | Redis connection string | `rediss://default:pass@redis-host:6379` |
| `JWT_ACCESS_SECRET` | 256-bit secret for access tokens | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET`| 256-bit secret for refresh tokens | `openssl rand -hex 32` |
| `CLIENT_URL` | Production frontend domain | `https://flashfashion.com` |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `https://flashfashion.com,https://admin.flashfashion.com` |

---

## 4. Production Hardening Features Implemented

1. **Security Headers (Helmet)**:
   - Sets secure headers including `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`, and disabled X-Powered-By.

2. **Reverse Proxy Trust**:
   - `app.set("trust proxy", 1)` is enabled to ensure accurate client IP logging and sliding-window rate limiting behind Nginx, AWS ALB, or Cloudflare.

3. **Rate Limiting**:
   - Backed by Redis sliding window (`rateLimiter`) to prevent brute force and DDoS on critical endpoints.

4. **Dynamic CORS**:
   - Restricts API access to authorized frontend origins while allowing headless/mobile/cron requests.

5. **Liveness & Readiness Health Check**:
   - `GET /api/health` continuously validates server uptime, PostgreSQL query engine, and Redis connection state.
