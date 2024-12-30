#!/bin/bash

# Key Rotation Script for Task Management System
# Version: 1.0.0
# Dependencies:
# - aws-cli (latest)
# - jq (latest)
# - openssl (latest)

set -euo pipefail

# Global Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
KEY_ROTATION_INTERVAL=7776000  # 90 days in seconds
BACKUP_RETENTION_PERIOD=31536000  # 365 days in seconds
LOG_FILE="/var/log/key-rotation.log"
ROTATION_LOCK_FILE="/var/run/key-rotation.lock"
ERROR_THRESHOLD=3
VALIDATION_TIMEOUT=300

# Logging function with timestamps
log() {
    local level=$1
    shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*" >> "$LOG_FILE"
    if [[ $level == "ERROR" ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*" >&2
    fi
}

# Validate all prerequisites before starting rotation
validate_prerequisites() {
    log "INFO" "Validating prerequisites..."
    
    # Check for required tools
    for cmd in aws jq openssl; do
        if ! command -v "$cmd" &> /dev/null; then
            log "ERROR" "Required command '$cmd' not found"
            return 1
        fi
    done
    
    # Verify AWS credentials and permissions
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "Invalid AWS credentials or permissions"
        return 1
    }
    
    # Check write permissions for log and lock files
    if ! touch "$LOG_FILE" 2>/dev/null; then
        log "ERROR" "Cannot write to log file: $LOG_FILE"
        return 1
    }
    
    # Verify access to AWS services
    if ! aws kms list-keys --region "$AWS_REGION" &> /dev/null; then
        log "ERROR" "Cannot access AWS KMS"
        return 1
    }
    
    if ! aws secretsmanager list-secrets --region "$AWS_REGION" &> /dev/null; then
        log "ERROR" "Cannot access AWS Secrets Manager"
        return 1
    }
    
    log "INFO" "Prerequisites validation successful"
    return 0
}

# Create secure backup of current keys
backup_old_keys() {
    local backup_date
    backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_file="/var/backup/keys_${backup_date}.enc"
    
    log "INFO" "Creating encrypted backup of current keys..."
    
    # Generate backup encryption key
    local backup_key
    backup_key=$(openssl rand -base64 32)
    
    # Export current secrets
    aws secretsmanager get-secret-value \
        --secret-id "task-management/jwt-secrets" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text | \
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -pass "pass:${backup_key}" \
        -out "$backup_file"
    
    # Calculate and store checksum
    sha256sum "$backup_file" > "${backup_file}.sha256"
    
    # Encrypt and store backup key
    aws kms encrypt \
        --key-id "alias/key-backup-key" \
        --plaintext "$backup_key" \
        --region "$AWS_REGION" \
        --output text \
        --query CiphertextBlob > "${backup_file}.key"
    
    log "INFO" "Backup created successfully: $backup_file"
    return 0
}

# Rotate JWT secrets
rotate_jwt_secrets() {
    log "INFO" "Starting JWT secrets rotation..."
    
    # Generate new secrets with high entropy
    local new_access_secret
    new_access_secret=$(openssl rand -base64 48)
    local new_refresh_secret
    new_refresh_secret=$(openssl rand -base64 64)
    
    # Validate secret strength
    if [[ ${#new_access_secret} -lt 32 || ${#new_refresh_secret} -lt 32 ]]; then
        log "ERROR" "Generated secrets do not meet minimum length requirements"
        return 1
    }
    
    # Create JSON payload
    local secret_payload
    secret_payload=$(jq -n \
        --arg access "$new_access_secret" \
        --arg refresh "$new_refresh_secret" \
        '{"accessTokenSecret": $access, "refreshTokenSecret": $refresh}')
    
    # Update secrets in AWS Secrets Manager
    if ! aws secretsmanager update-secret \
        --secret-id "task-management/jwt-secrets" \
        --secret-string "$secret_payload" \
        --region "$AWS_REGION"; then
        log "ERROR" "Failed to update JWT secrets"
        return 1
    }
    
    log "INFO" "JWT secrets rotated successfully"
    return 0
}

# Rotate OAuth client secrets
rotate_oauth_keys() {
    log "INFO" "Starting OAuth client secrets rotation..."
    
    # Get current OAuth client configuration
    local client_id
    client_id=$(aws secretsmanager get-secret-value \
        --secret-id "task-management/oauth-config" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text | jq -r '.clientId')
    
    # Generate new client secret
    local new_client_secret
    new_client_secret=$(openssl rand -base64 48)
    
    # Update Auth0 configuration (example using Auth0 Management API)
    if ! curl -X PATCH \
        "https://${AUTH0_DOMAIN}/api/v2/clients/${client_id}" \
        -H "Authorization: Bearer ${AUTH0_MANAGEMENT_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"client_secret\": \"${new_client_secret}\"}"; then
        log "ERROR" "Failed to update OAuth client secret"
        return 1
    }
    
    # Update secret in AWS Secrets Manager
    local oauth_payload
    oauth_payload=$(jq -n \
        --arg secret "$new_client_secret" \
        --arg id "$client_id" \
        '{"clientId": $id, "clientSecret": $secret}')
    
    if ! aws secretsmanager update-secret \
        --secret-id "task-management/oauth-config" \
        --secret-string "$oauth_payload" \
        --region "$AWS_REGION"; then
        log "ERROR" "Failed to update OAuth configuration"
        return 1
    }
    
    log "INFO" "OAuth client secrets rotated successfully"
    return 0
}

# Rotate encryption keys
rotate_encryption_keys() {
    log "INFO" "Starting encryption keys rotation..."
    
    # Create new KMS key version
    local key_id
    key_id=$(aws kms list-aliases \
        --region "$AWS_REGION" \
        --query 'Aliases[?AliasName==`alias/task-management-key`].TargetKeyId' \
        --output text)
    
    if ! aws kms create-key \
        --description "Task Management System Encryption Key - $(date +%Y%m%d)" \
        --region "$AWS_REGION"; then
        log "ERROR" "Failed to create new KMS key"
        return 1
    }
    
    # Update key alias to point to new key
    if ! aws kms update-alias \
        --alias-name "alias/task-management-key" \
        --target-key-id "$key_id" \
        --region "$AWS_REGION"; then
        log "ERROR" "Failed to update KMS key alias"
        return 1
    }
    
    # Schedule old key for deletion (30 days)
    if ! aws kms schedule-key-deletion \
        --key-id "$key_id" \
        --pending-window-in-days 30 \
        --region "$AWS_REGION"; then
        log "ERROR" "Failed to schedule old key deletion"
        return 1
    }
    
    log "INFO" "Encryption keys rotated successfully"
    return 0
}

# Main key rotation function
rotate_all_keys() {
    local rotation_start
    rotation_start=$(date +%s)
    
    # Check for existing rotation lock
    if [ -f "$ROTATION_LOCK_FILE" ]; then
        log "ERROR" "Another key rotation process is running"
        return 1
    }
    
    # Create rotation lock
    touch "$ROTATION_LOCK_FILE"
    
    log "INFO" "Starting key rotation process..."
    
    # Validate prerequisites
    if ! validate_prerequisites; then
        log "ERROR" "Prerequisites validation failed"
        rm -f "$ROTATION_LOCK_FILE"
        return 1
    }
    
    # Create backup of current keys
    if ! backup_old_keys; then
        log "ERROR" "Backup creation failed"
        rm -f "$ROTATION_LOCK_FILE"
        return 1
    }
    
    # Rotate all keys
    local error_count=0
    
    if ! rotate_jwt_secrets; then
        ((error_count++))
        log "ERROR" "JWT secrets rotation failed"
    fi
    
    if ! rotate_oauth_keys; then
        ((error_count++))
        log "ERROR" "OAuth keys rotation failed"
    fi
    
    if ! rotate_encryption_keys; then
        ((error_count++))
        log "ERROR" "Encryption keys rotation failed"
    fi
    
    # Check error threshold
    if [ "$error_count" -gt "$ERROR_THRESHOLD" ]; then
        log "ERROR" "Key rotation failed: too many errors ($error_count)"
        rm -f "$ROTATION_LOCK_FILE"
        return 1
    }
    
    # Clean up old backups
    find /var/backup -name "keys_*.enc" -mtime +${BACKUP_RETENTION_PERIOD} -delete
    
    # Remove rotation lock
    rm -f "$ROTATION_LOCK_FILE"
    
    local rotation_end
    rotation_end=$(date +%s)
    log "INFO" "Key rotation completed successfully in $((rotation_end - rotation_start)) seconds"
    return 0
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    rotate_all_keys
fi