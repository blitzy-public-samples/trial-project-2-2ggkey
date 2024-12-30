#!/bin/bash

# Setup Routes Script for Kong API Gateway v3.4+
# Purpose: Configure and validate service routes, security policies, and rate limiting
# for Task Management System microservices

# Set strict error handling
set -euo pipefail
IFS=$'\n\t'

# External dependencies:
# - curl v7.88+ : HTTP request handling
# - jq v1.6+ : JSON processing
# - kong v3.4+ : API Gateway core

# Environment variables
KONG_ADMIN_URL=${KONG_ADMIN_URL:-"http://localhost:8001"}
KONG_PROXY_URL=${KONG_PROXY_URL:-"http://localhost:8000"}
AUTH_SERVICE_HOST=${AUTH_SERVICE_HOST:-"auth-service:3000"}
TASK_SERVICE_HOST=${TASK_SERVICE_HOST:-"task-service:8080"}
FILE_SERVICE_HOST=${FILE_SERVICE_HOST:-"file-service:4000"}
NOTIFICATION_SERVICE_HOST=${NOTIFICATION_SERVICE_HOST:-"notification-service:5000"}
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-5}
REQUEST_TIMEOUT=${REQUEST_TIMEOUT:-10}
LOG_LEVEL=${LOG_LEVEL:-"INFO"}

# Logging setup with correlation IDs
log() {
    local level=$1
    local message=$2
    local correlation_id=$(cat /proc/sys/kernel/random/uuid)
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] [$correlation_id] $message"
}

# Retry logic for API calls
retry_command() {
    local cmd=$1
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if eval "$cmd"; then
            return 0
        fi
        retries=$((retries + 1))
        log "WARN" "Command failed, retry $retries of $MAX_RETRIES in $RETRY_DELAY seconds"
        sleep $RETRY_DELAY
    done
    
    log "ERROR" "Command failed after $MAX_RETRIES retries"
    return 1
}

# Validate Kong Admin API availability
check_kong_availability() {
    log "INFO" "Checking Kong Admin API availability"
    local check_cmd="curl -s -o /dev/null -w '%{http_code}' --max-time $REQUEST_TIMEOUT ${KONG_ADMIN_URL}/status"
    
    if ! retry_command "$check_cmd"; then
        log "ERROR" "Kong Admin API is not available"
        exit 1
    fi
    log "INFO" "Kong Admin API is available"
}

# Setup authentication service routes
setup_auth_routes() {
    log "INFO" "Setting up authentication service routes"
    
    # Create auth service
    local create_service="curl -s -X POST ${KONG_ADMIN_URL}/services \
        -d name=auth-service \
        -d url=http://${AUTH_SERVICE_HOST} \
        -d connect_timeout=60000 \
        -d write_timeout=60000 \
        -d read_timeout=60000"
    
    retry_command "$create_service"
    
    # Configure routes
    local create_routes="curl -s -X POST ${KONG_ADMIN_URL}/services/auth-service/routes \
        -d 'paths[]=/api/v1/auth' \
        -d 'paths[]=/api/v1/users' \
        -d protocols[]=http \
        -d protocols[]=https \
        -d strip_path=false"
    
    retry_command "$create_routes"
    
    # Apply security plugins
    local plugins=("jwt" "cors" "rate-limiting" "ip-restriction" "bot-detection")
    for plugin in "${plugins[@]}"; do
        local add_plugin="curl -s -X POST ${KONG_ADMIN_URL}/services/auth-service/plugins \
            -d name=$plugin"
        retry_command "$add_plugin"
    done
    
    log "INFO" "Authentication service routes configured successfully"
}

# Setup task service routes
setup_task_routes() {
    log "INFO" "Setting up task service routes"
    
    # Create task service
    local create_service="curl -s -X POST ${KONG_ADMIN_URL}/services \
        -d name=task-service \
        -d url=http://${TASK_SERVICE_HOST} \
        -d connect_timeout=60000 \
        -d write_timeout=60000 \
        -d read_timeout=60000"
    
    retry_command "$create_service"
    
    # Configure routes
    local create_routes="curl -s -X POST ${KONG_ADMIN_URL}/services/task-service/routes \
        -d 'paths[]=/api/v1/tasks' \
        -d 'paths[]=/api/v1/projects' \
        -d protocols[]=http \
        -d protocols[]=https \
        -d strip_path=false"
    
    retry_command "$create_routes"
    
    # Apply plugins with rate limiting
    local add_rate_limit="curl -s -X POST ${KONG_ADMIN_URL}/services/task-service/plugins \
        -d name=rate-limiting \
        -d config.minute=1000 \
        -d config.policy=local"
    
    retry_command "$add_rate_limit"
    
    log "INFO" "Task service routes configured successfully"
}

# Setup file service routes
setup_file_routes() {
    log "INFO" "Setting up file service routes"
    
    # Create file service
    local create_service="curl -s -X POST ${KONG_ADMIN_URL}/services \
        -d name=file-service \
        -d url=http://${FILE_SERVICE_HOST} \
        -d connect_timeout=60000 \
        -d write_timeout=120000 \
        -d read_timeout=120000"
    
    retry_command "$create_service"
    
    # Configure routes with file size limits
    local create_routes="curl -s -X POST ${KONG_ADMIN_URL}/services/file-service/routes \
        -d 'paths[]=/api/v1/files' \
        -d protocols[]=http \
        -d protocols[]=https \
        -d strip_path=false"
    
    retry_command "$create_routes"
    
    # Apply security plugins
    local add_request_size_limiting="curl -s -X POST ${KONG_ADMIN_URL}/services/file-service/plugins \
        -d name=request-size-limiting \
        -d config.allowed_payload_size=10"
    
    retry_command "$add_request_size_limiting"
    
    log "INFO" "File service routes configured successfully"
}

# Setup notification service routes
setup_notification_routes() {
    log "INFO" "Setting up notification service routes"
    
    # Create notification service
    local create_service="curl -s -X POST ${KONG_ADMIN_URL}/services \
        -d name=notification-service \
        -d url=http://${NOTIFICATION_SERVICE_HOST} \
        -d connect_timeout=60000 \
        -d write_timeout=60000 \
        -d read_timeout=60000"
    
    retry_command "$create_service"
    
    # Configure HTTP routes
    local create_http_routes="curl -s -X POST ${KONG_ADMIN_URL}/services/notification-service/routes \
        -d 'paths[]=/api/v1/notifications' \
        -d protocols[]=http \
        -d protocols[]=https \
        -d strip_path=false"
    
    retry_command "$create_http_routes"
    
    # Configure WebSocket routes
    local create_ws_routes="curl -s -X POST ${KONG_ADMIN_URL}/services/notification-service/routes \
        -d 'paths[]=/ws' \
        -d protocols[]=ws \
        -d protocols[]=wss \
        -d strip_path=false"
    
    retry_command "$create_ws_routes"
    
    log "INFO" "Notification service routes configured successfully"
}

# Verify route setup
verify_route_setup() {
    log "INFO" "Verifying route setup"
    local services=("auth-service" "task-service" "file-service" "notification-service")
    
    for service in "${services[@]}"; do
        local check_service="curl -s -o /dev/null -w '%{http_code}' --max-time $REQUEST_TIMEOUT ${KONG_ADMIN_URL}/services/${service}"
        if ! retry_command "$check_service"; then
            log "ERROR" "Service verification failed for ${service}"
            return 1
        fi
    done
    
    log "INFO" "Route verification completed successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting Kong route setup"
    
    # Check Kong availability
    check_kong_availability
    
    # Setup services
    setup_auth_routes
    setup_task_routes
    setup_file_routes
    setup_notification_routes
    
    # Verify setup
    if verify_route_setup; then
        log "INFO" "Kong route setup completed successfully"
        exit 0
    else
        log "ERROR" "Kong route setup failed"
        exit 1
    fi
}

# Execute main function
main

```

This script provides a comprehensive setup for Kong API Gateway routes with the following key features:

1. Robust error handling and retry logic for API calls
2. Structured logging with correlation IDs for traceability
3. Service-specific configurations with security plugins
4. Rate limiting implementation (1000 req/min as specified)
5. WebSocket support for notification service
6. File upload size restrictions for file service
7. Comprehensive verification of route setup
8. Environment variable configuration with sensible defaults

The script follows enterprise-grade practices including:
- Strict error handling with set -euo pipefail
- Comprehensive logging for debugging and auditing
- Retry logic for resilience
- Modular function design for maintainability
- Security-first approach with proper plugin configuration
- Verification steps to ensure successful setup

Make the script executable with:
```bash
chmod +x setup-routes.sh
```

Run it with:
```bash
./setup-routes.sh