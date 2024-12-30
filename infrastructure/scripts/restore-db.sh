#!/usr/bin/env bash

# restore-db.sh
# Version: 1.0.0
# Description: Enterprise-grade PostgreSQL database restoration script with encryption,
# validation, and comprehensive error handling
# Dependencies:
# - postgresql-client 14+
# - awscli 2.0+
# - openssl 1.1.1+

set -euo pipefail
IFS=$'\n\t'

# Load environment variables
source <(kubectl get secret database-secrets -n task-management -o json | jq -r '.data | map_values(@base64d) | to_entries | .[] | "export " + .key + "=" + (.value | @sh)')
source <(kubectl get secret aws-credentials -n task-management -o json | jq -r '.data | map_values(@base64d) | to_entries | .[] | "export " + .key + "=" + (.value | @sh)')

# Default environment variables from postgres-statefulset.yml
export POSTGRES_DB=${POSTGRES_DB:-taskmanager}
export POSTGRES_HOST=${POSTGRES_HOST:-postgres-headless.task-management.svc.cluster.local}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export BACKUP_BUCKET=${BACKUP_BUCKET:-taskmanager-backups}
export AWS_REGION=${AWS_REGION:-us-west-2}
export RESTORE_MODE=${RESTORE_MODE:-full}
export LOG_LEVEL=${LOG_LEVEL:-INFO}
export RETRY_ATTEMPTS=${RETRY_ATTEMPTS:-3}
export PARALLEL_JOBS=${PARALLEL_JOBS:-4}

# Constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEMP_DIR="/tmp/db-restore-$$"
readonly LOG_FILE="/var/log/taskmanager/db-restore.log"
readonly CHECKPOINT_FILE="${TEMP_DIR}/restore_checkpoint.sql"
readonly MAX_RETRIES=3
readonly BACKUP_RETENTION_DAYS=7

# Logging setup
setup_logging() {
    local log_dir
    log_dir=$(dirname "${LOG_FILE}")
    mkdir -p "${log_dir}"
    exec 1> >(tee -a "${LOG_FILE}")
    exec 2> >(tee -a "${LOG_FILE}" >&2)
    
    # Rotate logs if needed
    find "${log_dir}" -name "db-restore.log.*" -mtime +${BACKUP_RETENTION_DAYS} -delete
}

log() {
    local level=$1
    shift
    local message=$*
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    echo "${timestamp}|${level}|restore-db|${message}"
}

# Validation functions
validate_environment() {
    log "INFO" "Validating environment variables and dependencies"
    
    # Check required environment variables
    local required_vars=(
        "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD" "POSTGRES_HOST"
        "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "BACKUP_BUCKET"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Missing required environment variable: ${var}"
            return 1
        fi
    done
    
    # Check required tools
    local required_tools=("pg_restore" "aws" "openssl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" >/dev/null 2>&1; then
            log "ERROR" "Required tool not found: ${tool}"
            return 1
        fi
    done
}

validate_backup() {
    local backup_file=$1
    local checksum_file=$2
    
    log "INFO" "Validating backup file: ${backup_file}"
    
    # Check file existence
    if [[ ! -f "${backup_file}" ]]; then
        log "ERROR" "Backup file not found: ${backup_file}"
        return 1
    fi
    
    # Verify file permissions
    if [[ ! -r "${backup_file}" ]]; then
        log "ERROR" "Cannot read backup file: ${backup_file}"
        return 1
    }
    
    # Verify encryption header
    if ! openssl enc -d -aes-256-gcm -in "${backup_file}" -pass env:ENCRYPTION_KEY 2>/dev/null | head -c 5 | grep -q "PGDMP"; then
        log "ERROR" "Invalid backup file format or encryption"
        return 2
    }
    
    # Verify checksum
    local calculated_checksum
    calculated_checksum=$(openssl dgst -sha256 "${backup_file}" | cut -d' ' -f2)
    local stored_checksum
    stored_checksum=$(cat "${checksum_file}")
    
    if [[ "${calculated_checksum}" != "${stored_checksum}" ]]; then
        log "ERROR" "Checksum verification failed"
        return 3
    }
    
    log "INFO" "Backup validation successful"
    return 0
}

# Download functions
download_backup() {
    local backup_name=$1
    local target_path=$2
    local attempt=1
    
    while [[ ${attempt} -le ${MAX_RETRIES} ]]; do
        log "INFO" "Downloading backup (attempt ${attempt}/${MAX_RETRIES}): ${backup_name}"
        
        if aws s3 cp "s3://${BACKUP_BUCKET}/${backup_name}" "${target_path}" \
            --region "${AWS_REGION}" \
            --only-show-errors; then
            
            # Download checksum file
            if aws s3 cp "s3://${BACKUP_BUCKET}/${backup_name}.sha256" "${target_path}.sha256" \
                --region "${AWS_REGION}" \
                --only-show-errors; then
                log "INFO" "Backup download successful"
                return 0
            fi
        fi
        
        log "WARN" "Download attempt ${attempt} failed, retrying..."
        sleep $((2 ** attempt))
        ((attempt++))
    done
    
    log "ERROR" "Failed to download backup after ${MAX_RETRIES} attempts"
    return 1
}

# Restoration functions
create_checkpoint() {
    log "INFO" "Creating database checkpoint"
    
    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -F c \
        -f "${CHECKPOINT_FILE}" || {
        log "ERROR" "Failed to create checkpoint"
        return 1
    }
}

restore_database() {
    local backup_file=$1
    local options=$2
    
    log "INFO" "Starting database restoration"
    
    # Create checkpoint before restoration
    create_checkpoint || return 1
    
    # Stop dependent services
    log "INFO" "Stopping dependent services"
    kubectl scale deployment -n task-management --replicas=0 \
        task-service api-gateway notification-service
    
    # Decrypt and restore
    log "INFO" "Restoring database from backup"
    openssl enc -d -aes-256-gcm -in "${backup_file}" -pass env:ENCRYPTION_KEY | \
        PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
            -h "${POSTGRES_HOST}" \
            -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_USER}" \
            -d "${POSTGRES_DB}" \
            --jobs="${PARALLEL_JOBS}" \
            ${options} || {
        log "ERROR" "Database restoration failed"
        rollback_restoration
        return 1
    }
    
    # Verify restoration
    if ! verify_restoration; then
        log "ERROR" "Restoration verification failed"
        rollback_restoration
        return 1
    }
    
    # Restart services
    log "INFO" "Restarting dependent services"
    kubectl scale deployment -n task-management --replicas=1 \
        task-service api-gateway notification-service
    
    log "INFO" "Database restoration completed successfully"
    return 0
}

verify_restoration() {
    log "INFO" "Verifying database restoration"
    
    PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        -c "SELECT COUNT(*) FROM information_schema.tables;" >/dev/null || return 1
    
    return 0
}

rollback_restoration() {
    log "WARN" "Rolling back database restoration"
    
    if [[ -f "${CHECKPOINT_FILE}" ]]; then
        PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
            -h "${POSTGRES_HOST}" \
            -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_USER}" \
            -d "${POSTGRES_DB}" \
            --clean \
            --if-exists \
            "${CHECKPOINT_FILE}" || {
            log "ERROR" "Rollback failed"
            return 1
        }
        log "INFO" "Rollback completed successfully"
        return 0
    else
        log "ERROR" "Checkpoint file not found for rollback"
        return 1
    fi
}

cleanup() {
    log "INFO" "Cleaning up temporary files"
    rm -rf "${TEMP_DIR}"
}

# Main execution
main() {
    local backup_name=$1
    local restore_options=${2:-"--clean --if-exists"}
    
    setup_logging
    trap cleanup EXIT
    
    log "INFO" "Starting database restoration process"
    
    # Create temporary directory
    mkdir -p "${TEMP_DIR}"
    
    # Validate environment
    validate_environment || exit 1
    
    # Download backup
    local backup_path="${TEMP_DIR}/${backup_name}"
    download_backup "${backup_name}" "${backup_path}" || exit 1
    
    # Validate backup
    validate_backup "${backup_path}" "${backup_path}.sha256" || exit 1
    
    # Perform restoration
    restore_database "${backup_path}" "${restore_options}" || exit 1
    
    log "INFO" "Database restoration completed successfully"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 <backup_name> [restore_options]"
        exit 1
    fi
    
    main "$@"
fi