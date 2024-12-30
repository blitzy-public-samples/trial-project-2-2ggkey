#!/bin/bash

# Build All Services Script v1.0
# Purpose: Enterprise-grade build script for Task Management System microservices
# with enhanced security, monitoring, and parallel build capabilities

# Set strict error handling
set -euo pipefail
IFS=$'\n\t'

# Required versions:
# - Docker v24.0+
# - docker-compose v2.20+
# - curl v7.0+

# Environment variables with defaults
export BUILD_MODE=${BUILD_MODE:-"production"}
export DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-1}
export COMPOSE_DOCKER_CLI_BUILD=${COMPOSE_DOCKER_CLI_BUILD:-1}
export BUILD_PARALLEL_JOBS=${BUILD_PARALLEL_JOBS:-4}
export BUILD_CACHE_TTL=${BUILD_CACHE_TTL:-"168h"}
export HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}

# Logging setup
LOG_DIR="/var/log/task-management/builds"
LOG_FILE="${LOG_DIR}/build-$(date +%Y%m%d-%H%M%S).log"
AUDIT_FILE="${LOG_DIR}/audit-$(date +%Y%m%d-%H%M%S).log"

# Initialize logging
setup_logging() {
    mkdir -p "${LOG_DIR}"
    touch "${LOG_FILE}" "${AUDIT_FILE}"
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
}

# Enhanced logging with correlation IDs
log() {
    local level=$1
    local message=$2
    local correlation_id=$(cat /proc/sys/kernel/random/uuid)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] [${correlation_id}] ${message}"
}

# Audit logging for security and compliance
audit_log() {
    local event=$1
    local details=$2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [AUDIT] ${event}: ${details}" >> "${AUDIT_FILE}"
}

# Check build prerequisites
check_prerequisites() {
    log "INFO" "Checking build prerequisites..."

    # Check Docker version
    if ! docker version --format '{{.Server.Version}}' | grep -qE "^24\."; then
        log "ERROR" "Docker version 24.0+ is required"
        return 1
    fi

    # Check docker-compose version
    if ! docker-compose version --short | grep -qE "^2\.2"; then
        log "ERROR" "docker-compose version 2.20+ is required"
        return 1
    }

    # Check available disk space (minimum 20GB)
    local available_space=$(df -BG /var/lib/docker | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "${available_space}" -lt 20 ]; then
        log "ERROR" "Insufficient disk space. Required: 20GB, Available: ${available_space}GB"
        return 1
    }

    # Verify BuildKit support
    if ! docker buildx version >/dev/null 2>&1; then
        log "ERROR" "BuildKit support is required"
        return 1
    }

    # Check network connectivity
    if ! curl -s --connect-timeout 5 https://registry.hub.docker.com >/dev/null; then
        log "ERROR" "No connection to Docker Hub"
        return 1
    }

    log "INFO" "Prerequisites check passed"
    return 0
}

# Build services with dependency management
build_services() {
    log "INFO" "Starting service builds..."
    
    # Enable BuildKit optimizations
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    # Build base images first
    log "INFO" "Building base images..."
    docker-compose build --parallel --build-arg BUILD_MODE="${BUILD_MODE}" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
        api-gateway

    # Build services in dependency order
    local services=(
        "postgres"
        "redis"
        "rabbitmq"
        "api-gateway"
        "auth-service"
        "task-service"
        "notification-service"
        "file-service"
    )

    for service in "${services[@]}"; do
        log "INFO" "Building ${service}..."
        if ! docker-compose build \
            --build-arg BUILD_MODE="${BUILD_MODE}" \
            --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
            --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
            "${service}"; then
            log "ERROR" "Failed to build ${service}"
            return 1
        fi
        audit_log "SERVICE_BUILD" "Successfully built ${service}"
    done

    return 0
}

# Verify builds with comprehensive checks
verify_builds() {
    log "INFO" "Verifying service builds..."
    local services=(
        "api-gateway"
        "auth-service"
        "task-service"
        "notification-service"
        "file-service"
    )

    for service in "${services[@]}"; do
        # Check if image exists
        if ! docker image inspect "task-management/${service}:latest" >/dev/null 2>&1; then
            log "ERROR" "Image for ${service} not found"
            return 1
        fi

        # Verify image size
        local image_size=$(docker image inspect "task-management/${service}:latest" --format='{{.Size}}')
        if [ "${image_size}" -gt 2000000000 ]; then  # 2GB limit
            log "WARN" "Image size for ${service} exceeds 2GB: ${image_size} bytes"
        fi

        # Check for required labels
        local required_labels=("maintainer" "version" "description")
        for label in "${required_labels[@]}"; do
            if ! docker image inspect "task-management/${service}:latest" --format='{{.Config.Labels}}' | grep -q "${label}"; then
                log "ERROR" "Required label '${label}' missing in ${service}"
                return 1
            fi
        done

        audit_log "IMAGE_VERIFICATION" "Verified ${service} image"
    done

    return 0
}

# Cleanup build artifacts
cleanup_builds() {
    log "INFO" "Cleaning up build artifacts..."

    # Remove build cache older than TTL
    if [ -n "${BUILD_CACHE_TTL}" ]; then
        docker builder prune --filter "until=${BUILD_CACHE_TTL}" --force
    fi

    # Remove dangling images
    docker image prune --force

    # Remove temporary build files
    rm -rf /tmp/build-*

    audit_log "BUILD_CLEANUP" "Cleaned up build artifacts"
    return 0
}

# Main execution flow
main() {
    local start_time=$(date +%s)
    
    setup_logging
    log "INFO" "Starting build process in ${BUILD_MODE} mode"
    audit_log "BUILD_START" "Build initiated in ${BUILD_MODE} mode"

    # Execute build phases
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    fi

    if ! build_services; then
        log "ERROR" "Service build failed"
        exit 1
    fi

    if ! verify_builds; then
        log "ERROR" "Build verification failed"
        exit 1
    fi

    if ! cleanup_builds; then
        log "WARN" "Build cleanup failed"
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "INFO" "Build completed successfully in ${duration} seconds"
    audit_log "BUILD_COMPLETE" "Build completed in ${duration} seconds"
    
    return 0
}

# Execute main with error handling
if ! main; then
    log "ERROR" "Build process failed"
    exit 1
fi

exit 0
```

This script provides an enterprise-grade build system for the Task Management System microservices with the following key features:

1. Strict error handling and process management
2. Comprehensive logging with correlation IDs and audit trails
3. Prerequisite validation including version checks and resource availability
4. Parallel build capabilities with dependency management
5. Build verification with security and quality checks
6. Cleanup of build artifacts with TTL management
7. Environment-aware building with production/development modes
8. BuildKit optimization support
9. Audit logging for compliance and tracking

The script follows enterprise best practices including:
- Strict error handling with set -euo pipefail
- Detailed logging for debugging and auditing
- Security-first approach with verification steps
- Resource management and cleanup
- Modular function design
- Environment variable configuration with sensible defaults

Make the script executable with:
```bash
chmod +x build-all.sh
```

Run it with:
```bash
./build-all.sh