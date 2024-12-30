#!/bin/bash

# SSL/TLS Certificate Generation Script for Task Management System
# Version: 1.0.0
# Security Level: Enhanced Enterprise Grade
# OpenSSL Version Required: 1.1.1+

# Enable strict error handling
set -euo pipefail

# Global variables with secure defaults
CERT_DIR="/etc/nginx/ssl"
CERT_FILE="${CERT_DIR}/server.crt"
KEY_FILE="${CERT_DIR}/server.key"
CSR_FILE="${CERT_DIR}/server.csr"
DAYS_VALID="365"
KEY_SIZE="4096"
CIPHER_CONFIG="ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
LOG_FILE="/var/log/nginx/cert-gen.log"
OPENSSL_MIN_VERSION="1.1.1"

# Secure logging function
log_secure() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] $1" | tee -a "${LOG_FILE}"
}

# Error handling function with secure cleanup
error_handler() {
    local line_no=$1
    local error_code=$2
    log_secure "ERROR: Script failed at line ${line_no} with error code ${error_code}"
    # Secure cleanup of sensitive files
    if [[ -f "${KEY_FILE}.tmp" ]]; then
        shred -u "${KEY_FILE}.tmp"
    fi
    if [[ -f "${CSR_FILE}.tmp" ]]; then
        shred -u "${CSR_FILE}.tmp"
    fi
    exit "${error_code}"
}

# Set error trap
trap 'error_handler ${LINENO} $?' ERR

# Check for root privileges
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_secure "ERROR: This script must be run as root"
        exit 1
    fi
}

# Verify OpenSSL installation and version
check_openssl() {
    log_secure "Verifying OpenSSL installation and security requirements..."
    
    # Check OpenSSL existence
    if ! command -v openssl >/dev/null 2>&1; then
        log_secure "ERROR: OpenSSL is not installed"
        return 1
    }

    # Verify OpenSSL version
    local version
    version=$(openssl version | cut -d' ' -f2)
    if [[ "${version}" < "${OPENSSL_MIN_VERSION}" ]]; then
        log_secure "ERROR: OpenSSL version ${version} is below minimum required version ${OPENSSL_MIN_VERSION}"
        return 1
    }

    # Verify TLS 1.3 support
    if ! openssl ciphers -v | grep -q "TLSv1.3"; then
        log_secure "ERROR: OpenSSL installation does not support TLS 1.3"
        return 1
    }

    log_secure "OpenSSL verification completed successfully"
    return 0
}

# Create and secure certificate directory
create_cert_directory() {
    log_secure "Creating secure certificate directory..."
    
    # Set secure umask
    umask 077
    
    # Create directory if it doesn't exist
    mkdir -p "${CERT_DIR}"
    
    # Set secure permissions
    chmod 700 "${CERT_DIR}"
    chown nginx:nginx "${CERT_DIR}"
    
    # Verify permissions
    if [[ $(stat -c %a "${CERT_DIR}") != "700" ]]; then
        log_secure "ERROR: Failed to set secure permissions on certificate directory"
        return 1
    }
    
    log_secure "Certificate directory created and secured successfully"
    return 0
}

# Generate private key with enhanced security
generate_private_key() {
    log_secure "Generating secure private key..."
    
    # Generate key with strong entropy
    openssl genpkey \
        -algorithm RSA \
        -pkeyopt rsa_keygen_bits:${KEY_SIZE} \
        -aes256 \
        -out "${KEY_FILE}.tmp" \
        2>/dev/null
    
    # Set secure permissions
    chmod 600 "${KEY_FILE}.tmp"
    chown nginx:nginx "${KEY_FILE}.tmp"
    
    # Verify key strength
    local key_size_check
    key_size_check=$(openssl rsa -in "${KEY_FILE}.tmp" -text -noout | grep "Private-Key:" | grep -o "[0-9]*")
    if [[ "${key_size_check}" -ne "${KEY_SIZE}" ]]; then
        log_secure "ERROR: Generated key size does not match required size"
        return 1
    }
    
    # Move to final location
    mv "${KEY_FILE}.tmp" "${KEY_FILE}"
    
    log_secure "Private key generated successfully"
    return 0
}

# Generate CSR with enhanced parameters
generate_csr() {
    log_secure "Generating Certificate Signing Request..."
    
    # Create CSR configuration
    cat > "${CERT_DIR}/csr.conf" <<EOF
[req]
default_bits = ${KEY_SIZE}
prompt = no
default_md = sha384
req_extensions = req_ext
distinguished_name = dn

[dn]
C=US
ST=State
L=City
O=Task Management System
OU=Security Operations
CN=taskmanagement.local

[req_ext]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = taskmanagement.local
DNS.2 = www.taskmanagement.local
EOF

    # Generate CSR
    openssl req \
        -new \
        -key "${KEY_FILE}" \
        -out "${CSR_FILE}.tmp" \
        -config "${CERT_DIR}/csr.conf" \
        2>/dev/null
    
    # Set secure permissions
    chmod 600 "${CSR_FILE}.tmp"
    chown nginx:nginx "${CSR_FILE}.tmp"
    
    # Move to final location
    mv "${CSR_FILE}.tmp" "${CSR_FILE}"
    
    # Clean up configuration
    rm -f "${CERT_DIR}/csr.conf"
    
    log_secure "CSR generated successfully"
    return 0
}

# Generate self-signed certificate with enhanced security
generate_self_signed_cert() {
    log_secure "Generating self-signed certificate..."
    
    openssl x509 \
        -req \
        -days "${DAYS_VALID}" \
        -in "${CSR_FILE}" \
        -signkey "${KEY_FILE}" \
        -out "${CERT_FILE}.tmp" \
        -sha384 \
        -extensions req_ext \
        -extfile "${CERT_DIR}/csr.conf" \
        2>/dev/null
    
    # Set secure permissions
    chmod 600 "${CERT_FILE}.tmp"
    chown nginx:nginx "${CERT_FILE}.tmp"
    
    # Verify certificate
    if ! openssl verify -CAfile "${CERT_FILE}.tmp" "${CERT_FILE}.tmp" >/dev/null 2>&1; then
        log_secure "ERROR: Certificate verification failed"
        return 1
    }
    
    # Move to final location
    mv "${CERT_FILE}.tmp" "${CERT_FILE}"
    
    log_secure "Self-signed certificate generated successfully"
    return 0
}

# Main execution
main() {
    log_secure "Starting SSL/TLS certificate generation process..."
    
    # Check root privileges
    check_root
    
    # Verify OpenSSL
    check_openssl
    
    # Create certificate directory
    create_cert_directory
    
    # Generate private key
    generate_private_key
    
    # Generate CSR
    generate_csr
    
    # Generate self-signed certificate
    generate_self_signed_cert
    
    # Final security verification
    log_secure "Performing final security verification..."
    
    # Verify file permissions and ownership
    for file in "${KEY_FILE}" "${CSR_FILE}" "${CERT_FILE}"; do
        if [[ ! -f "${file}" ]]; then
            log_secure "ERROR: Required file ${file} is missing"
            return 1
        fi
        if [[ $(stat -c %a "${file}") != "600" ]]; then
            log_secure "ERROR: Incorrect permissions on ${file}"
            return 1
        fi
        if [[ $(stat -c %U:%G "${file}") != "nginx:nginx" ]]; then
            log_secure "ERROR: Incorrect ownership on ${file}"
            return 1
        fi
    done
    
    log_secure "Certificate generation completed successfully"
    return 0
}

# Execute main function
main

exit 0