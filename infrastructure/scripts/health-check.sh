#!/bin/bash

# Health Check Script v1.0
# Comprehensive system health monitoring for Task Management System
# Dependencies: curl v7.88+, jq v1.6+

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_FAILURE=1

# Configuration
readonly TIMEOUT_SECONDS=5
readonly MAX_RETRIES=3
readonly WARN_THRESHOLD=75
readonly CRIT_THRESHOLD=90
readonly LOG_FILE="/var/log/health-check.log"
readonly RESULT_FILE="/var/lib/health-check/status.json"

# Ensure required directories exist
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$RESULT_FILE")"

# Logging function with timestamp
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# Error handling function
handle_error() {
    local error_msg="$1"
    log "ERROR" "$error_msg"
    echo "{\"status\": \"error\", \"message\": \"$error_msg\"}" > "$RESULT_FILE"
    exit "$EXIT_FAILURE"
}

# Retry mechanism with exponential backoff
retry_with_backoff() {
    local cmd="$1"
    local retry_count=0
    local max_retries="$MAX_RETRIES"
    local timeout="$TIMEOUT_SECONDS"
    
    until $cmd || [ $retry_count -eq $max_retries ]; do
        retry_count=$((retry_count + 1))
        local wait_time=$((2 ** retry_count))
        log "WARN" "Retry $retry_count/$max_retries - waiting $wait_time seconds"
        sleep $wait_time
    done
    
    if [ $retry_count -eq $max_retries ]; then
        return 1
    fi
    return 0
}

# Service health check function
check_service_health() {
    local service_name="$1"
    local endpoint_url="$2"
    local retry_count="${3:-$MAX_RETRIES}"
    local timeout="${4:-$TIMEOUT_SECONDS}"
    
    log "INFO" "Checking health for service: $service_name"
    
    local start_time=$(date +%s%N)
    local response
    response=$(curl -s -w "\n%{http_code}" --max-time "$timeout" "$endpoint_url" 2>/dev/null)
    local status=$?
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $status -ne 0 ]; then
        log "ERROR" "Failed to connect to $service_name: $response"
        return 1
    fi
    
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)
    
    # Validate response
    if [ "$http_code" != "200" ]; then
        log "ERROR" "$service_name returned HTTP $http_code"
        return 1
    fi
    
    echo "{\"service\": \"$service_name\", \"status\": \"healthy\", \"response_time\": $response_time, \"http_code\": $http_code, \"body\": $response_body}"
    return 0
}

# Database health check function
check_database_connection() {
    local db_host="$1"
    local db_port="$2"
    local db_type="$3"
    
    log "INFO" "Checking $db_type database connection at $db_host:$db_port"
    
    case "$db_type" in
        "postgres")
            if ! command -v psql &> /dev/null; then
                log "ERROR" "psql client not found"
                return 1
            fi
            
            PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null
            local status=$?
            ;;
        *)
            log "ERROR" "Unsupported database type: $db_type"
            return 1
            ;;
    esac
    
    if [ $status -ne 0 ]; then
        log "ERROR" "Database connection failed"
        return 1
    fi
    
    echo "{\"database\": \"$db_type\", \"status\": \"connected\", \"host\": \"$db_host\", \"port\": $db_port}"
    return 0
}

# Redis health check function
check_redis_health() {
    local redis_host="$1"
    local redis_port="$2"
    local cluster_mode="$3"
    
    log "INFO" "Checking Redis health at $redis_host:$redis_port"
    
    if ! command -v redis-cli &> /dev/null; then
        log "ERROR" "redis-cli not found"
        return 1
    }
    
    local redis_info
    redis_info=$(redis-cli -h "$redis_host" -p "$redis_port" INFO 2>/dev/null)
    local status=$?
    
    if [ $status -ne 0 ]; then
        log "ERROR" "Redis connection failed"
        return 1
    }
    
    # Parse key metrics
    local used_memory=$(echo "$redis_info" | grep "used_memory_human:" | cut -d: -f2 | tr -d '[:space:]')
    local connected_clients=$(echo "$redis_info" | grep "connected_clients:" | cut -d: -f2 | tr -d '[:space:]')
    
    echo "{\"redis\": \"healthy\", \"memory_usage\": \"$used_memory\", \"clients\": $connected_clients}"
    return 0
}

# RabbitMQ health check function
check_rabbitmq_health() {
    local rabbitmq_host="$1"
    local rabbitmq_port="$2"
    local vhost="$3"
    
    log "INFO" "Checking RabbitMQ health at $rabbitmq_host:$rabbitmq_port"
    
    local response
    response=$(curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASS" \
        "http://$rabbitmq_host:15672/api/healthchecks/node" 2>/dev/null)
    local status=$?
    
    if [ $status -ne 0 ]; then
        log "ERROR" "RabbitMQ connection failed"
        return 1
    }
    
    echo "$response"
    return 0
}

# Disk space check function
check_disk_space() {
    local mount_point="$1"
    local threshold_percent="$2"
    local include_io_stats="$3"
    
    log "INFO" "Checking disk space for $mount_point"
    
    local disk_usage
    disk_usage=$(df -h "$mount_point" | tail -n1)
    local used_percent=$(echo "$disk_usage" | awk '{print $5}' | tr -d '%')
    
    if [ "$used_percent" -gt "$threshold_percent" ]; then
        log "WARN" "Disk usage above threshold: $used_percent%"
        return 1
    }
    
    local io_stats=""
    if [ "$include_io_stats" = true ] && command -v iostat &> /dev/null; then
        io_stats=$(iostat -x 1 2 | tail -n2)
    fi
    
    echo "{\"mount_point\": \"$mount_point\", \"usage_percent\": $used_percent, \"io_stats\": \"$io_stats\"}"
    return 0
}

# Main function orchestrating all health checks
main() {
    log "INFO" "Starting health check"
    
    # Initialize results array
    local results=()
    local overall_status="healthy"
    
    # Check core services
    local service_health
    service_health=$(check_service_health "api-gateway" "http://localhost:8080/health")
    if [ $? -ne 0 ]; then
        overall_status="unhealthy"
    fi
    results+=("$service_health")
    
    # Check database
    local db_health
    db_health=$(check_database_connection "localhost" 5432 "postgres")
    if [ $? -ne 0 ]; then
        overall_status="unhealthy"
    fi
    results+=("$db_health")
    
    # Check Redis
    local redis_health
    redis_health=$(check_redis_health "localhost" 6379 "standalone")
    if [ $? -ne 0 ]; then
        overall_status="unhealthy"
    fi
    results+=("$redis_health")
    
    # Check RabbitMQ
    local rabbitmq_health
    rabbitmq_health=$(check_rabbitmq_health "localhost" 5672 "/")
    if [ $? -ne 0 ]; then
        overall_status="unhealthy"
    fi
    results+=("$rabbitmq_health")
    
    # Check disk space
    local disk_health
    disk_health=$(check_disk_space "/var" "$WARN_THRESHOLD" true)
    if [ $? -ne 0 ]; then
        overall_status="unhealthy"
    fi
    results+=("$disk_health")
    
    # Aggregate results
    local final_result="{\"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"status\": \"$overall_status\", \"checks\": [${results[@]}]}"
    
    # Save results
    echo "$final_result" > "$RESULT_FILE"
    
    # Log completion
    log "INFO" "Health check completed with status: $overall_status"
    
    if [ "$overall_status" = "healthy" ]; then
        return "$EXIT_SUCCESS"
    else
        return "$EXIT_FAILURE"
    fi
}

# Trap errors
trap 'handle_error "Script interrupted"' INT TERM

# Execute main function
main "$@"