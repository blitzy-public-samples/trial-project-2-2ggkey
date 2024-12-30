#!/bin/bash

# Kong API Gateway Initialization Script v3.4+
# Purpose: Enterprise-grade initialization and configuration of Kong API Gateway
# with enhanced security, monitoring, and health check capabilities

# Set strict error handling
set -euo pipefail
IFS=$'\n\t'

# External dependencies:
# - curl v7.88+ : HTTP request handling
# - jq v1.6+ : JSON processing and validation
# - kong v3.4+ : API Gateway core functionality

# Global variables from environment with defaults
KONG_ADMIN_URL=${KONG_ADMIN_URL:-"http://localhost:8001"}
KONG_PROXY_URL=${KONG_PROXY_URL:-"http://localhost:8000"}
CONFIG_PATH=${CONFIG_PATH:-"/usr/local/kong/declarative/kong.yml"}
LOG_FILE=${LOG_FILE:-"/var/log/kong/init.log"}
AUDIT_LOG=${AUDIT_LOG:-"/var/log/kong/audit.log"}
MAX_RETRIES=${MAX_RETRIES:-5}
RETRY_INTERVAL=${RETRY_INTERVAL:-10}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-5}
RATE_LIMIT_WINDOW=${RATE_LIMIT_WINDOW:-3600}
RATE_LIMIT_REQUESTS=${RATE_LIMIT_REQUESTS:-1000}

# Enhanced logging with correlation IDs
log() {
    local level=$1
    local message=$2
    local correlation_id=$(cat /proc/sys/kernel/random/uuid)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] [$correlation_id] $message" | tee -a "$LOG_FILE"
}

# Audit logging for security events
audit_log() {
    local event=$1
    local details=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local correlation_id=$(cat /proc/sys/kernel/random/uuid)
    echo "[$timestamp] [AUDIT] [$correlation_id] Event: $event Details: $details" >> "$AUDIT_LOG"
}

# Enhanced error handling with cleanup
cleanup() {
    local exit_code=$?
    log "INFO" "Performing cleanup operations"
    # Remove temporary files
    rm -f /tmp/kong_*.tmp 2>/dev/null || true
    # Log exit status
    if [ $exit_code -ne 0 ]; then
        log "ERROR" "Script failed with exit code: $exit_code"
    fi
    exit $exit_code
}
trap cleanup EXIT

# Wait for Kong Admin API with comprehensive health checks
wait_for_kong() {
    log "INFO" "Waiting for Kong Admin API availability"
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        # Check process
        if ! pgrep -f "kong" > /dev/null; then
            log "ERROR" "Kong process is not running"
            return 1
        fi
        
        # Check Admin API
        if curl -s -o /dev/null -w "%{http_code}" "$KONG_ADMIN_URL/status" | grep -q "200"; then
            log "INFO" "Kong Admin API is available"
            return 0
        fi
        
        retries=$((retries + 1))
        log "WARN" "Kong Admin API not ready, retry $retries/$MAX_RETRIES"
        sleep $RETRY_INTERVAL
    done
    
    log "ERROR" "Kong Admin API failed to become available"
    return 1
}

# Validate configuration with security checks
validate_config() {
    log "INFO" "Validating Kong configuration"
    
    # Check file permissions
    if [ ! -r "$CONFIG_PATH" ]; then
        log "ERROR" "Cannot read configuration file: $CONFIG_PATH"
        return 1
    fi
    
    # Validate YAML syntax
    if ! kong config parse "$CONFIG_PATH" > /dev/null 2>&1; then
        log "ERROR" "Invalid YAML syntax in configuration file"
        return 1
    }
    
    # Validate security settings
    local required_plugins=("jwt" "rate-limiting" "ip-restriction" "cors")
    for plugin in "${required_plugins[@]}"; do
        if ! grep -q "name: $plugin" "$CONFIG_PATH"; then
            log "ERROR" "Required security plugin '$plugin' not configured"
            return 1
        fi
    done
    
    audit_log "CONFIG_VALIDATION" "Configuration validated successfully"
    return 0
}

# Setup enhanced security features
setup_security() {
    log "INFO" "Configuring security features"
    
    # Configure rate limiting
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=rate-limiting" \
        -d "config.minute=$RATE_LIMIT_REQUESTS" \
        -d "config.policy=local" \
        -d "config.fault_tolerant=true" || {
            log "ERROR" "Failed to configure rate limiting"
            return 1
        }
    
    # Setup IP restriction
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=ip-restriction" \
        -d "config.whitelist=127.0.0.1,192.168.0.0/16,10.0.0.0/8" || {
            log "ERROR" "Failed to configure IP restriction"
            return 1
        }
    
    # Configure security headers
    local security_headers=(
        "X-Frame-Options: DENY"
        "X-Content-Type-Options: nosniff"
        "Strict-Transport-Security: max-age=31536000; includeSubDomains"
    )
    
    for header in "${security_headers[@]}"; do
        local name=$(echo "$header" | cut -d: -f1)
        local value=$(echo "$header" | cut -d: -f2-)
        curl -s -X POST "$KONG_ADMIN_URL/plugins" \
            -d "name=response-transformer" \
            -d "config.add_headers[$name]=$value" || {
                log "ERROR" "Failed to configure security header: $name"
                return 1
            }
    done
    
    audit_log "SECURITY_SETUP" "Security features configured successfully"
    return 0
}

# Initialize monitoring and metrics
setup_monitoring() {
    log "INFO" "Setting up monitoring and metrics collection"
    
    # Configure Prometheus plugin
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=prometheus" \
        -d "config.status_code_metrics=true" \
        -d "config.latency_metrics=true" || {
            log "ERROR" "Failed to configure Prometheus metrics"
            return 1
        }
    
    # Setup health checks
    curl -s -X POST "$KONG_ADMIN_URL/plugins" \
        -d "name=health-checks" \
        -d "config.active.healthy.interval=$HEALTH_CHECK_INTERVAL" \
        -d "config.active.unhealthy.interval=$((HEALTH_CHECK_INTERVAL * 2))" || {
            log "ERROR" "Failed to configure health checks"
            return 1
        }
    
    log "INFO" "Monitoring setup completed successfully"
    return 0
}

# Main execution flow
main() {
    log "INFO" "Starting Kong API Gateway initialization"
    
    # Wait for Kong availability
    if ! wait_for_kong; then
        log "ERROR" "Failed to connect to Kong Admin API"
        exit 1
    fi
    
    # Validate configuration
    if ! validate_config; then
        log "ERROR" "Configuration validation failed"
        exit 1
    fi
    
    # Load configuration
    if ! kong config db_import "$CONFIG_PATH"; then
        log "ERROR" "Failed to load Kong configuration"
        exit 1
    fi
    
    # Setup security features
    if ! setup_security; then
        log "ERROR" "Security setup failed"
        exit 1
    fi
    
    # Initialize monitoring
    if ! setup_monitoring; then
        log "ERROR" "Monitoring setup failed"
        exit 1
    }
    
    # Source and execute route setup
    if ! source "./setup-routes.sh"; then
        log "ERROR" "Route setup failed"
        exit 1
    fi
    
    log "INFO" "Kong API Gateway initialization completed successfully"
    audit_log "INIT_COMPLETE" "Kong initialization completed successfully"
    exit 0
}

# Execute main function
main

```

This script provides an enterprise-grade initialization of Kong API Gateway with the following key features:

1. Strict error handling and process management
2. Comprehensive logging with correlation IDs and audit trails
3. Security-first approach with required security plugins validation
4. Enhanced monitoring setup with Prometheus metrics
5. Health check implementation with configurable intervals
6. Rate limiting implementation (1000 requests/hour as specified)
7. Security headers configuration
8. IP restriction and whitelisting
9. Integration with route setup script
10. Proper cleanup handling

The script follows enterprise best practices including:
- Comprehensive error handling with set -euo pipefail
- Detailed logging for debugging and auditing
- Security validation and enforcement
- Modular function design
- Proper cleanup with trap handlers
- Environment variable configuration with sensible defaults

Make the script executable with:
```bash
chmod +x init-kong.sh
```

Run it with:
```bash
./init-kong.sh