# Build stage
FROM python:3.11-slim AS builder

# Build-time labels
LABEL maintainer="DevOps Team" \
      version="1.0.0" \
      description="Notification service for task management system"

# Set build arguments and environment variables
ARG APP_HOME=/app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies and security updates
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create app directory and user
RUN useradd -m -r -s /bin/bash nonroot && \
    mkdir -p ${APP_HOME} && \
    chown nonroot:nonroot ${APP_HOME}

WORKDIR ${APP_HOME}

# Install Python dependencies
COPY --chown=nonroot:nonroot requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Runtime labels
LABEL maintainer="DevOps Team" \
      version="1.0.0" \
      environment="production" \
      service="notification-service"

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_HOME=/app \
    PORT=8000 \
    WORKERS=4 \
    TIMEOUT=120 \
    MAX_REQUESTS=10000 \
    MAX_REQUESTS_JITTER=1000

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create app directory and user
RUN useradd -m -r -s /bin/bash nonroot && \
    mkdir -p ${APP_HOME} && \
    chown nonroot:nonroot ${APP_HOME}

WORKDIR ${APP_HOME}

# Copy dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy application code
COPY --chown=nonroot:nonroot src ${APP_HOME}/src
COPY --chown=nonroot:nonroot tests ${APP_HOME}/tests

# Switch to non-root user
USER nonroot

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

# Expose port
EXPOSE ${PORT}

# Set entrypoint
ENTRYPOINT ["uvicorn", "src.app:app", "--host", "0.0.0.0"]

# Set default command with production configurations
CMD ["--port", "8000", \
     "--workers", "4", \
     "--timeout-keep-alive", "120", \
     "--limit-max-requests", "10000", \
     "--limit-max-requests-jitter", "1000", \
     "--no-access-log"]