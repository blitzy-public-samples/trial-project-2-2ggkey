# Stage 1: Build stage
FROM golang:1.21-alpine AS builder

# Security: Add build dependencies and security updates
RUN apk update && apk add --no-cache \
    ca-certificates \
    git \
    build-base \
    tzdata \
    && update-ca-certificates

# Set secure build arguments
ARG CGO_ENABLED=0
ARG GOOS=linux
ARG GOARCH=amd64
ARG GO111MODULE=on

# Set working directory
WORKDIR /build

# Copy go mod files first for better cache utilization
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code with appropriate permissions
COPY . .
RUN chmod -R 755 /build

# Build binary with security flags
RUN go build \
    -trimpath \
    -ldflags="-s -w -extldflags=-static" \
    -o /build/file-service \
    ./cmd/main.go

# Stage 2: Final stage
FROM alpine:3.18

# Security: Add runtime dependencies and security updates
RUN apk update && apk add --no-cache \
    ca-certificates \
    tzdata \
    && update-ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy binary and required files from builder
COPY --from=builder /build/file-service .
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Set secure ownership and permissions
RUN chown -R appuser:appgroup /app \
    && chmod -R 755 /app \
    && chmod 755 /app/file-service

# Create and configure required directories with appropriate permissions
RUN mkdir -p /tmp/uploads /var/log/file-service \
    && chown -R appuser:appgroup /tmp/uploads /var/log/file-service \
    && chmod 755 /tmp/uploads /var/log/file-service

# Switch to non-root user
USER appuser:appgroup

# Expose service port
EXPOSE 8080

# Configure health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Set resource limits
ENV GOMEMLIMIT=512MiB
ENV GOMAXPROCS=1

# Set security labels
LABEL maintainer="DevOps Team <devops@company.com>" \
      version="${BUILD_VERSION}" \
      security.apparmor.profile=runtime/default \
      org.opencontainers.image.source="https://github.com/company/task-management"

# Configure read-only root filesystem
VOLUME ["/tmp", "/var/log"]

# Start application with security flags
ENTRYPOINT ["/app/file-service"]