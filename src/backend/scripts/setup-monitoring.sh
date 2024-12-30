#!/bin/bash

# Setup Monitoring Stack v1.0.0
# This script automates the deployment and configuration of a highly available
# monitoring stack including Prometheus, Grafana, and Alertmanager.

set -euo pipefail

# Global variables
readonly MONITORING_NAMESPACE="monitoring"
readonly PROMETHEUS_VERSION="2.45.0"
readonly GRAFANA_VERSION="9.5.0"
readonly ALERTMANAGER_VERSION="0.25.0"
readonly RETENTION_DAYS="30"
readonly HA_REPLICAS="3"
readonly BACKUP_RETENTION="7"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validation functions
validate_prerequisites() {
    local missing_tools=()
    
    # Check required tools
    for tool in kubectl helm jq curl; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster"
        exit 1
    }
}

validate_storage_class() {
    local storage_class=$1
    
    if ! kubectl get storageclass "$storage_class" &> /dev/null; then
        log_error "Storage class '$storage_class' not found"
        exit 1
    }
}

# Setup functions
setup_prometheus() {
    local namespace=$1
    local config_path=$2
    local storage_class=$3
    local retention_days=$4
    
    log_info "Setting up Prometheus v${PROMETHEUS_VERSION}"
    
    # Add and update Prometheus helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Create ConfigMap for Prometheus configuration
    kubectl create configmap prometheus-config \
        --from-file="$config_path" \
        -n "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Prometheus with HA configuration
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$namespace" \
        --version "$PROMETHEUS_VERSION" \
        --set server.replicaCount="$HA_REPLICAS" \
        --set server.retention="${retention_days}d" \
        --set server.persistentVolume.storageClass="$storage_class" \
        --set server.persistentVolume.size=100Gi \
        --set alertmanager.enabled=false \
        --values - <<EOF
server:
  podAntiAffinity: true
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfied: DoNotSchedule
  resources:
    requests:
      cpu: 1
      memory: 4Gi
    limits:
      cpu: 2
      memory: 8Gi
EOF
    
    # Verify deployment
    kubectl rollout status statefulset/prometheus-server -n "$namespace" --timeout=300s
}

setup_grafana() {
    local namespace=$1
    local datasources_path=$2
    local dashboard_path=$3
    local admin_password=$4
    
    log_info "Setting up Grafana v${GRAFANA_VERSION}"
    
    # Add and update Grafana helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Create ConfigMaps for Grafana configuration
    kubectl create configmap grafana-datasources \
        --from-file="$datasources_path" \
        -n "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create configmap grafana-dashboards \
        --from-file="$dashboard_path" \
        -n "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Grafana with HA configuration
    helm upgrade --install grafana grafana/grafana \
        --namespace "$namespace" \
        --version "$GRAFANA_VERSION" \
        --set replicas="$HA_REPLICAS" \
        --set persistence.enabled=true \
        --set persistence.storageClassName="$storage_class" \
        --set persistence.size=10Gi \
        --set adminPassword="$admin_password" \
        --values - <<EOF
deploymentStrategy:
  type: RollingUpdate
podAntiAffinity:
  enabled: true
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 1
    memory: 2Gi
EOF
    
    # Verify deployment
    kubectl rollout status deployment/grafana -n "$namespace" --timeout=300s
}

setup_alertmanager() {
    local namespace=$1
    local config_path=$2
    local secrets_path=$3
    
    log_info "Setting up Alertmanager v${ALERTMANAGER_VERSION}"
    
    # Create Secret for Alertmanager configuration
    kubectl create secret generic alertmanager-config \
        --from-file="$config_path" \
        --from-file="$secrets_path" \
        -n "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Alertmanager with HA configuration
    helm upgrade --install alertmanager prometheus-community/alertmanager \
        --namespace "$namespace" \
        --version "$ALERTMANAGER_VERSION" \
        --set replicaCount="$HA_REPLICAS" \
        --set persistence.enabled=true \
        --set persistence.storageClassName="$storage_class" \
        --set persistence.size=10Gi \
        --values - <<EOF
configSecret: alertmanager-config
podAntiAffinity:
  enabled: true
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 200m
    memory: 512Mi
EOF
    
    # Verify deployment
    kubectl rollout status statefulset/alertmanager -n "$namespace" --timeout=300s
}

verify_monitoring() {
    local namespace=$1
    local success=true
    
    log_info "Verifying monitoring stack deployment"
    
    # Check all pods are running
    if ! kubectl get pods -n "$namespace" | grep -q "Running"; then
        log_error "Not all pods are running in namespace $namespace"
        success=false
    fi
    
    # Verify Prometheus targets
    local prometheus_pod
    prometheus_pod=$(kubectl get pods -n "$namespace" -l app=prometheus -o jsonpath='{.items[0].metadata.name}')
    if ! kubectl exec -n "$namespace" "$prometheus_pod" -c prometheus -- wget -qO- http://localhost:9090/-/ready | grep -q "Prometheus is Ready"; then
        log_error "Prometheus is not ready"
        success=false
    fi
    
    # Verify Grafana health
    local grafana_pod
    grafana_pod=$(kubectl get pods -n "$namespace" -l app=grafana -o jsonpath='{.items[0].metadata.name}')
    if ! kubectl exec -n "$namespace" "$grafana_pod" -- wget -qO- http://localhost:3000/api/health | grep -q "ok"; then
        log_error "Grafana is not healthy"
        success=false
    }
    
    # Verify Alertmanager mesh
    local alertmanager_pod
    alertmanager_pod=$(kubectl get pods -n "$namespace" -l app=alertmanager -o jsonpath='{.items[0].metadata.name}')
    if ! kubectl exec -n "$namespace" "$alertmanager_pod" -- wget -qO- http://localhost:9093/-/ready | grep -q "OK"; then
        log_error "Alertmanager is not ready"
        success=false
    fi
    
    return "$success"
}

# Main setup function
main() {
    local config_dir="$1"
    local storage_class="$2"
    local admin_password="$3"
    
    # Validate prerequisites
    validate_prerequisites
    validate_storage_class "$storage_class"
    
    # Create monitoring namespace
    kubectl create namespace "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Setup components
    setup_prometheus "$MONITORING_NAMESPACE" \
        "${config_dir}/prometheus.yml" \
        "$storage_class" \
        "$RETENTION_DAYS"
    
    setup_grafana "$MONITORING_NAMESPACE" \
        "${config_dir}/datasources.yml" \
        "${config_dir}/dashboards" \
        "$admin_password"
    
    setup_alertmanager "$MONITORING_NAMESPACE" \
        "${config_dir}/alertmanager.yml" \
        "${config_dir}/alertmanager-secrets.yml"
    
    # Verify setup
    if verify_monitoring "$MONITORING_NAMESPACE"; then
        log_info "Monitoring stack setup completed successfully"
        return 0
    else
        log_error "Monitoring stack setup failed verification"
        return 1
    fi
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -ne 3 ]]; then
        echo "Usage: $0 <config_directory> <storage_class> <grafana_admin_password>"
        exit 1
    fi
    
    main "$1" "$2" "$3"
fi