# Multi-stage build for backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ .
RUN npm run build

# Multi-stage build for frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY front-end/package*.json ./
RUN npm ci --only=production

COPY front-end/ .
RUN npm run build

# Multi-stage build for storefront
FROM node:18-alpine AS storefront-builder

WORKDIR /app/storefront
COPY storefront/package*.json ./
RUN npm ci --only=production

COPY storefront/ .
RUN npm run build

# Production image
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend ./backend
WORKDIR /app/backend

# Install production dependencies
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]

# Frontend Dockerfile
FROM node:18-alpine AS frontend-production

WORKDIR /app

COPY --from=frontend-builder /app/frontend ./front-end
WORKDIR /app/front-end

RUN npm ci --only=production

EXPOSE 3000

USER nextjs

CMD ["npm", "start"]

# Storefront Dockerfile
FROM node:18-alpine AS storefront-production

WORKDIR /app

COPY --from=storefront-builder /app/storefront ./storefront
WORKDIR /app/storefront

RUN npm ci --only=production

EXPOSE 3001

USER nextjs

CMD ["npm", "start"]