#!/usr/bin/env bash

# Database Initialization Script for Task Management System
# Version: 1.0.0
# Required PostgreSQL Version: 14+
# Required Tools: psql (14+), openssl (1.1+)

set -euo pipefail
IFS=$'\n\t'

# Global variables with secure defaults
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-taskmanager}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_SSL_MODE="${POSTGRES_SSL_MODE:-prefer}"
POSTGRES_CONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT:-30}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Script constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly INIT_SQL_PATH="${SCRIPT_DIR}/../database/init.sql"
readonly REQUIRED_PG_VERSION="14.0"
readonly ERROR_CONNECTION=1
readonly ERROR_MIGRATION=2
readonly ERROR_PERMISSION=3
readonly ERROR_VALIDATION=4
readonly ERROR_TIMEOUT=5
readonly ERROR_SSL=6

# Logging functions
log_info() {
    if [[ "${LOG_LEVEL}" != "error" ]]; then
        echo "[INFO] $1" >&2
    fi
}

log_error() {
    echo "[ERROR] $1" >&2
}

log_debug() {
    if [[ "${LOG_LEVEL}" == "debug" ]]; then
        echo "[DEBUG] $1" >&2
    fi
}

# Validate environment and requirements
validate_environment() {
    local missing_vars=()

    # Check required environment variables
    [[ -z "${POSTGRES_USER}" ]] && missing_vars+=("POSTGRES_USER")
    [[ -z "${POSTGRES_PASSWORD}" ]] && missing_vars+=("POSTGRES_PASSWORD")
    [[ -z "${POSTGRES_DB}" ]] && missing_vars+=("POSTGRES_DB")
    [[ -z "${POSTGRES_HOST}" ]] && missing_vars+=("POSTGRES_HOST")
    [[ -z "${POSTGRES_PORT}" ]] && missing_vars+=("POSTGRES_PORT")

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        return ${ERROR_VALIDATION}
    fi

    # Validate PostgreSQL client version
    if ! command -v psql >/dev/null 2>&1; then
        log_error "PostgreSQL client (psql) not found"
        return ${ERROR_VALIDATION}
    fi

    local psql_version
    psql_version=$(psql --version | awk '{print $3}')
    if [[ "${psql_version}" < "${REQUIRED_PG_VERSION}" ]]; then
        log_error "PostgreSQL client version ${psql_version} is below required version ${REQUIRED_PG_VERSION}"
        return ${ERROR_VALIDATION}
    fi

    # Check SSL configuration if enabled
    if [[ "${POSTGRES_SSL_MODE}" != "disable" ]]; then
        if ! command -v openssl >/dev/null 2>&1; then
            log_error "OpenSSL is required for SSL mode but not found"
            return ${ERROR_SSL}
        fi
    fi

    # Verify SQL initialization file exists and is readable
    if [[ ! -r "${INIT_SQL_PATH}" ]]; then
        log_error "Cannot read initialization SQL file: ${INIT_SQL_PATH}"
        return ${ERROR_PERMISSION}
    }

    return 0
}

# Execute database initialization
execute_init_sql() {
    local connection_string="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    local psql_opts=(-v ON_ERROR_STOP=1 --no-psqlrc)

    # Add SSL options if enabled
    if [[ "${POSTGRES_SSL_MODE}" != "disable" ]]; then
        psql_opts+=(--set=sslmode="${POSTGRES_SSL_MODE}")
    fi

    # Execute initialization SQL with error handling
    if ! PGCONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT}" \
         psql "${psql_opts[@]}" \
         -f "${INIT_SQL_PATH}" \
         "${connection_string}"; then
        log_error "Failed to execute initialization SQL"
        return ${ERROR_MIGRATION}
    fi

    return 0
}

# Verify database setup
verify_database_setup() {
    local connection_string="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
    local verification_query="
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') as uuid_ext,
               EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') as crypto_ext,
               EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') as audit_table;
    "

    local verification_result
    verification_result=$(PGCONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT}" \
                         psql -t -A -c "${verification_query}" "${connection_string}")

    if [[ "${verification_result}" != "t|t|t" ]]; then
        log_error "Database verification failed. Required components are missing."
        return ${ERROR_VALIDATION}
    fi

    return 0
}

# Main execution flow
main() {
    log_info "Starting database initialization..."

    # Validate environment
    if ! validate_environment; then
        log_error "Environment validation failed"
        return ${ERROR_VALIDATION}
    }

    # Create database if it doesn't exist
    local create_db_string="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/postgres"
    if ! PGCONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT}" \
         psql -c "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}'" "${create_db_string}" | grep -q 1; then
        log_info "Creating database ${POSTGRES_DB}..."
        if ! PGCONNECT_TIMEOUT="${POSTGRES_CONNECT_TIMEOUT}" \
             createdb -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
             -U "${POSTGRES_USER}" "${POSTGRES_DB}"; then
            log_error "Failed to create database"
            return ${ERROR_MIGRATION}
        fi
    fi

    # Execute initialization SQL
    log_info "Executing database initialization..."
    if ! execute_init_sql; then
        log_error "Database initialization failed"
        return ${ERROR_MIGRATION}
    fi

    # Verify setup
    log_info "Verifying database setup..."
    if ! verify_database_setup; then
        log_error "Database verification failed"
        return ${ERROR_VALIDATION}
    fi

    log_info "Database initialization completed successfully"
    return 0
}

# Execute main function
main "$@"