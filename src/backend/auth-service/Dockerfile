# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies and TypeScript
RUN apk add --no-cache python3 make g++ \
    && npm install -g typescript@5.0.0

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code and config files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS=--no-deprecation \
    TZ=UTC

# Install production dependencies
RUN apk add --no-cache curl tzdata \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /usr/src/app

# Copy production dependencies and built files from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./

# Security hardening
RUN chown -R nodejs:nodejs /usr/src/app \
    && chmod -R 755 /usr/src/app \
    && mkdir -p /usr/src/app/logs \
    && chown -R nodejs:nodejs /usr/src/app/logs

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Set security options
LABEL security.nsa.gov.sensitivity=high
LABEL seccomp=unconfined
LABEL no-new-privileges=true

# Start the application
CMD ["node", "dist/app.js"]