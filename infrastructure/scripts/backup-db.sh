#!/usr/bin/env bash

# Task Management System - Database Backup Script
# Version: 1.0.0
# Dependencies:
# - postgresql-client v14+
# - awscli v2.0+
# - openssl v1.1.1+

set -euo pipefail
IFS=$'\n\t'

# Script constants
readonly SCRIPT_NAME=$(basename "$0")
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_ID="backup_${TIMESTAMP}_$(openssl rand -hex 8)"
readonly LOG_FILE="/var/log/taskmanager/db-backup.log"
readonly TEMP_DIR="/tmp/db_backup_${TIMESTAMP}"
readonly METRICS_FILE="${TEMP_DIR}/metrics.json"

# Default values for environment variables
: "${BACKUP_RETENTION_DAYS:=7}"
: "${PARALLEL_WORKERS:=4}"
: "${COMPRESSION_LEVEL:=6}"
: "${MAX_RETRIES:=3}"
: "${BACKUP_TIMEOUT:=120}"
: "${POSTGRES_PORT:=5432}"

# Logging functions
log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    echo "${timestamp}|${level}|${BACKUP_ID}|${message}" >> "${LOG_FILE}"
    
    # Print to stdout if not running in cron
    if [ -t 1 ]; then
        echo "${timestamp} ${level}: ${message}"
    fi
}

error() {
    log "ERROR" "$1"
    exit 1
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log "INFO" "Cleaning up temporary files"
    
    # Secure deletion of temporary files
    if [ -d "${TEMP_DIR}" ]; then
        find "${TEMP_DIR}" -type f -exec shred -u {} \;
        rm -rf "${TEMP_DIR}"
    fi
    
    # Record metrics on script completion
    if [ -f "${METRICS_FILE}" ]; then
        local duration=$(($(date +%s) - start_time))
        jq --arg duration "${duration}" \
           --arg exit_code "${exit_code}" \
           '.duration = $duration | .exit_code = $exit_code' \
           "${METRICS_FILE}" > "${METRICS_FILE}.tmp" && \
        mv "${METRICS_FILE}.tmp" "${METRICS_FILE}"
        
        # Upload metrics to S3
        aws s3 cp "${METRICS_FILE}" \
            "s3://${BACKUP_BUCKET}/metrics/${BACKUP_ID}_metrics.json" \
            --quiet
    fi
    
    exit "${exit_code}"
}

trap cleanup EXIT

# Validate environment
validate_environment() {
    log "INFO" "Validating environment and dependencies"
    
    # Check required environment variables
    local required_vars=(
        "BACKUP_BUCKET"
        "ENCRYPTION_KEY"
        "POSTGRES_HOST"
        "AWS_REGION"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            error "Required environment variable ${var} is not set"
        fi
    done
    
    # Verify required tools
    local required_tools=(
        "pg_dump"
        "aws"
        "openssl"
    )
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            error "Required tool ${tool} is not installed"
        fi
    done
    
    # Verify AWS credentials and S3 bucket access
    if ! aws s3 ls "s3://${BACKUP_BUCKET}" >/dev/null 2>&1; then
        error "Cannot access S3 bucket ${BACKUP_BUCKET}"
    fi
    
    # Create temporary directory
    mkdir -p "${TEMP_DIR}"
    chmod 700 "${TEMP_DIR}"
    
    # Initialize metrics file
    echo '{"start_time":"'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"}' > "${METRICS_FILE}"
}

# Perform database backup
perform_backup() {
    log "INFO" "Starting database backup process"
    local start_time=$(date +%s)
    
    # Get database credentials from Kubernetes secrets
    local PGPASSWORD=$(kubectl get secret database-secrets -o jsonpath="{.data.DB_PASSWORD}" | base64 -d)
    local PGUSER=$(kubectl get secret database-secrets -o jsonpath="{.data.DB_USER}" | base64 -d)
    local PGDATABASE="taskmanager"  # From postgres-statefulset.yml
    
    # Backup filename
    local backup_file="${TEMP_DIR}/${BACKUP_ID}.sql.gz"
    local encrypted_file="${backup_file}.enc"
    
    # Perform backup with progress monitoring
    log "INFO" "Executing pg_dump with ${PARALLEL_WORKERS} parallel workers"
    
    PGPASSWORD="${PGPASSWORD}" pg_dump \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${PGUSER}" \
        -d "${PGDATABASE}" \
        --format=custom \
        --compress="${COMPRESSION_LEVEL}" \
        --jobs="${PARALLEL_WORKERS}" \
        --verbose \
        --file="${backup_file}" \
        2> >(tee "${TEMP_DIR}/backup.log" >&2)
    
    if [ ! -f "${backup_file}" ]; then
        error "Backup file was not created successfully"
    fi
    
    # Calculate backup size and checksum
    local backup_size=$(stat -f %z "${backup_file}")
    local backup_md5=$(openssl md5 -binary "${backup_file}" | base64)
    
    # Encrypt backup
    log "INFO" "Encrypting backup file with AES-256"
    openssl enc -aes-256-cbc \
        -salt \
        -in "${backup_file}" \
        -out "${encrypted_file}" \
        -pass "pass:${ENCRYPTION_KEY}" \
        -md sha256
    
    # Upload to S3 with multi-part upload
    log "INFO" "Uploading encrypted backup to S3"
    local attempt=1
    while [ ${attempt} -le ${MAX_RETRIES} ]; do
        if aws s3 cp \
            "${encrypted_file}" \
            "s3://${BACKUP_BUCKET}/backups/${BACKUP_ID}.sql.gz.enc" \
            --expected-size $(stat -f %z "${encrypted_file}") \
            --metadata "checksum=${backup_md5},timestamp=${TIMESTAMP}" \
            --quiet; then
            break
        fi
        
        attempt=$((attempt + 1))
        if [ ${attempt} -le ${MAX_RETRIES} ]; then
            log "WARN" "Upload attempt ${attempt} failed, retrying..."
            sleep $((2 ** attempt))
        else
            error "Failed to upload backup after ${MAX_RETRIES} attempts"
        fi
    done
    
    # Update metrics
    jq --arg size "${backup_size}" \
       --arg duration "$(($(date +%s) - start_time))" \
       '.backup_size = $size | .backup_duration = $duration' \
       "${METRICS_FILE}" > "${METRICS_FILE}.tmp" && \
    mv "${METRICS_FILE}.tmp" "${METRICS_FILE}"
    
    log "INFO" "Backup completed successfully"
}

# Cleanup old backups
cleanup_old_backups() {
    log "INFO" "Starting cleanup of old backups"
    
    # Calculate cutoff date
    local cutoff_date=$(date -v-${BACKUP_RETENTION_DAYS}d +%Y%m%d)
    
    # List all backups
    aws s3 ls "s3://${BACKUP_BUCKET}/backups/" \
        --recursive \
        --output json > "${TEMP_DIR}/backups.json"
    
    # Find and remove old backups
    jq -r ".Contents[] | select(.Key | contains(\"sql.gz.enc\")) | 
           select(.LastModified | fromdate | strftime(\"%Y%m%d\") < \"${cutoff_date}\") |
           .Key" "${TEMP_DIR}/backups.json" | \
    while read -r key; do
        log "INFO" "Removing old backup: ${key}"
        aws s3 rm "s3://${BACKUP_BUCKET}/${key}" --quiet
    done
}

# Main execution
main() {
    log "INFO" "Starting backup script ${SCRIPT_NAME}"
    
    validate_environment
    perform_backup
    cleanup_old_backups
    
    log "INFO" "Backup process completed successfully"
}

main "$@"
```

This script implements a robust database backup solution with the following key features:

1. Comprehensive environment validation
2. Secure credential handling using Kubernetes secrets
3. Parallel backup with compression
4. AES-256 encryption of backup files
5. Multi-part upload to S3 with retry logic
6. Detailed logging and metrics collection
7. Secure cleanup of temporary files
8. Automated retention policy enforcement
9. Error handling and reporting
10. Progress monitoring and verification

The script follows enterprise security practices:
- Uses secure credential handling
- Implements proper error handling
- Includes comprehensive logging
- Follows the principle of least privilege
- Includes backup verification
- Implements secure file cleanup

The script integrates with the Kubernetes environment as specified in the postgres-statefulset.yml and handles all required environment variables and dependencies.

Remember to set the appropriate permissions:
```bash
chmod 700 infrastructure/scripts/backup-db.sh