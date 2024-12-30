#!/bin/bash

# ELK Stack Setup and Configuration Script
# Version: 1.0.0
# ELK Version: 7.17.0
# Purpose: Initialize and configure ELK stack with security, monitoring and retention capabilities

# Global Configuration Variables
ELK_VERSION="7.17.0"
LOG_RETENTION_DAYS=90
ELASTICSEARCH_HEAP="4g"
LOGSTASH_WORKERS=2
CERT_VALIDITY_DAYS=365
BACKUP_RETENTION_DAYS=30
MONITORING_INTERVAL="10s"
MAX_CONCURRENT_CONNECTIONS=100
ALERT_EMAIL="monitoring@taskmanager.com"

# Base directories
BASE_DIR="/opt/elk"
CERT_DIR="${BASE_DIR}/certs"
CONFIG_DIR="${BASE_DIR}/config"
BACKUP_DIR="${BASE_DIR}/backups"
LOG_DIR="${BASE_DIR}/logs"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message=$@
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
}

# Error handling function
handle_error() {
    local exit_code=$?
    local line_number=$1
    if [ $exit_code -ne 0 ]; then
        log "ERROR" "Failed at line ${line_number} with exit code ${exit_code}"
        exit $exit_code
    fi
}

# Set up trap for error handling
trap 'handle_error ${LINENO}' ERR

# Validate system requirements
check_system_requirements() {
    log "INFO" "Checking system requirements..."
    
    # Check Java version
    if ! command -v java >/dev/null 2>&1; then
        log "ERROR" "Java is not installed"
        exit 1
    fi
    
    # Check available memory
    total_mem=$(free -g | awk '/^Mem:/{print $2}')
    if [ $total_mem -lt 8 ]; then
        log "ERROR" "Insufficient memory. Minimum 8GB required"
        exit 1
    fi
    
    # Check disk space
    available_space=$(df -BG "${BASE_DIR}" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ $available_space -lt 50 ]; then
        log "ERROR" "Insufficient disk space. Minimum 50GB required"
        exit 1
    }
    
    log "INFO" "System requirements validated successfully"
}

# Generate SSL certificates
generate_certificates() {
    local output_dir=$1
    local validity_days=$2
    local key_size=$3
    local cert_password=$4
    
    log "INFO" "Generating SSL certificates..."
    
    mkdir -p "${output_dir}"
    
    # Generate CA certificate
    openssl req -x509 -newkey rsa:${key_size} -days ${validity_days} \
        -keyout "${output_dir}/ca.key" -out "${output_dir}/ca.crt" \
        -subj "/C=US/ST=State/L=City/O=TaskManager/CN=TaskManager CA" \
        -passout pass:${cert_password}
        
    # Generate certificates for each component
    for component in elasticsearch logstash kibana; do
        openssl req -newkey rsa:${key_size} -nodes \
            -keyout "${output_dir}/${component}.key" \
            -out "${output_dir}/${component}.csr" \
            -subj "/C=US/ST=State/L=City/O=TaskManager/CN=${component}"
            
        openssl x509 -req -in "${output_dir}/${component}.csr" \
            -CA "${output_dir}/ca.crt" -CAkey "${output_dir}/ca.key" \
            -CAcreateserial -out "${output_dir}/${component}.crt" \
            -days ${validity_days} -passin pass:${cert_password}
    done
    
    # Set proper permissions
    chmod 600 ${output_dir}/*.key
    chmod 644 ${output_dir}/*.crt
    
    log "INFO" "SSL certificates generated successfully"
    return 0
}

# Configure Elasticsearch
setup_elasticsearch() {
    local cluster_name=$1
    local node_name=$2
    local cert_path=$3
    local backup_path=$4
    local retention_days=$5
    
    log "INFO" "Configuring Elasticsearch..."
    
    # Create required directories
    mkdir -p "${BASE_DIR}/elasticsearch/data"
    mkdir -p "${BASE_DIR}/elasticsearch/logs"
    
    # Configure elasticsearch.yml
    cat > "${CONFIG_DIR}/elasticsearch/elasticsearch.yml" <<EOF
cluster.name: ${cluster_name}
node.name: ${node_name}
network.host: 0.0.0.0
http.port: 9200

# Security settings
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.transport.ssl.verification_mode: certificate
xpack.security.transport.ssl.key: ${cert_path}/elasticsearch.key
xpack.security.transport.ssl.certificate: ${cert_path}/elasticsearch.crt
xpack.security.transport.ssl.certificate_authorities: ${cert_path}/ca.crt

# Monitoring settings
xpack.monitoring.enabled: true
xpack.monitoring.collection.enabled: true

# Memory settings
bootstrap.memory_lock: true

# Backup settings
path.repo: ${backup_path}

# Index lifecycle settings
xpack.ilm.enabled: true
EOF
    
    # Configure JVM options
    cat > "${CONFIG_DIR}/elasticsearch/jvm.options" <<EOF
-Xms${ELASTICSEARCH_HEAP}
-Xmx${ELASTICSEARCH_HEAP}
-XX:+UseG1GC
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=${LOG_DIR}
EOF
    
    # Start Elasticsearch
    systemctl start elasticsearch
    
    # Wait for Elasticsearch to start
    until curl -s "http://localhost:9200/_cluster/health" > /dev/null; do
        log "INFO" "Waiting for Elasticsearch to start..."
        sleep 5
    done
    
    log "INFO" "Elasticsearch configured successfully"
    return 0
}

# Configure Logstash
setup_logstash() {
    local elasticsearch_hosts=$1
    local pipeline_path=$2
    local cert_path=$3
    local monitoring_interval=$4
    local worker_count=$5
    
    log "INFO" "Configuring Logstash..."
    
    # Create pipeline configuration
    mkdir -p "${CONFIG_DIR}/logstash/conf.d"
    
    # Configure logstash.yml
    cat > "${CONFIG_DIR}/logstash/logstash.yml" <<EOF
http.host: "0.0.0.0"
path.config: ${pipeline_path}
path.logs: ${LOG_DIR}/logstash

xpack.monitoring.enabled: true
xpack.monitoring.elasticsearch.hosts: ${elasticsearch_hosts}
xpack.monitoring.elasticsearch.ssl.certificate_authority: ${cert_path}/ca.crt
xpack.monitoring.elasticsearch.ssl.certificate: ${cert_path}/logstash.crt
xpack.monitoring.elasticsearch.ssl.key: ${cert_path}/logstash.key

pipeline.workers: ${worker_count}
pipeline.batch.size: 125
pipeline.batch.delay: 50
queue.type: persisted
EOF
    
    # Start Logstash
    systemctl start logstash
    
    log "INFO" "Logstash configured successfully"
    return 0
}

# Configure Kibana
setup_kibana() {
    local elasticsearch_url=$1
    local server_name=$2
    local cert_path=$3
    local session_timeout=$4
    local reporting_timeout=$5
    
    log "INFO" "Configuring Kibana..."
    
    # Configure kibana.yml
    cat > "${CONFIG_DIR}/kibana/kibana.yml" <<EOF
server.name: ${server_name}
server.host: "0.0.0.0"
server.ssl.enabled: true
server.ssl.certificate: ${cert_path}/kibana.crt
server.ssl.key: ${cert_path}/kibana.key

elasticsearch.hosts: ${elasticsearch_url}
elasticsearch.ssl.certificateAuthorities: ${cert_path}/ca.crt
elasticsearch.ssl.certificate: ${cert_path}/kibana.crt
elasticsearch.ssl.key: ${cert_path}/kibana.key

xpack.security.enabled: true
xpack.reporting.enabled: true
xpack.reporting.capture.timeout: ${reporting_timeout}

elasticsearch.requestTimeout: 30000
elasticsearch.shardTimeout: 30000

logging.dest: ${LOG_DIR}/kibana/kibana.log
pid.file: /var/run/kibana/kibana.pid

xpack.monitoring.enabled: true
xpack.monitoring.ui.container.elasticsearch.enabled: true
EOF
    
    # Start Kibana
    systemctl start kibana
    
    log "INFO" "Kibana configured successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting ELK stack setup..."
    
    # Check system requirements
    check_system_requirements
    
    # Create base directories
    mkdir -p "${BASE_DIR}" "${CERT_DIR}" "${CONFIG_DIR}" "${BACKUP_DIR}" "${LOG_DIR}"
    
    # Generate certificates
    generate_certificates "${CERT_DIR}" "${CERT_VALIDITY_DAYS}" 4096 "changeme"
    
    # Setup components
    setup_elasticsearch "task-manager" "node-1" "${CERT_DIR}" "${BACKUP_DIR}" "${LOG_RETENTION_DAYS}"
    setup_logstash "['https://localhost:9200']" "${CONFIG_DIR}/logstash/conf.d" "${CERT_DIR}" "${MONITORING_INTERVAL}" "${LOGSTASH_WORKERS}"
    setup_kibana "https://localhost:9200" "task-manager-kibana" "${CERT_DIR}" "1h" "30s"
    
    log "INFO" "ELK stack setup completed successfully"
}

# Execute main function
main "$@"