# ==============================================================================
# Flash Backend - Multi-Stage Production Dockerfile
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native packages (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package manifests first for optimal Docker layer caching
COPY package.json package-lock.json ./

# Clean installation of all dependencies (including devDependencies for build)
RUN npm ci

# Copy TypeScript configuration, Prisma schema/config, and application source code
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Compile TypeScript and bundle into standalone dist/index.js
RUN npm run build

# Remove development dependencies to keep production footprint minimal
RUN npm prune --production

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for container healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

# Security: Create and switch to non-root system user
USER node

# Copy production node_modules and compiled artifacts from builder stage
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma

EXPOSE 3000

# Docker native healthcheck polling the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "dist/index.js"]
