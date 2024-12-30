#!/usr/bin/env bash

# Setup Monitoring Stack v1.0.0
# This script automates the installation and configuration of Prometheus, Grafana,
# and Alertmanager with enhanced security features and validation checks.

set -euo pipefail

# Global variables
readonly MONITORING_NAMESPACE="monitoring"
readonly PROMETHEUS_VERSION="2.45.0"
readonly GRAFANA_VERSION="9.5.0"
readonly ALERTMANAGER_VERSION="0.25.0"
readonly RETENTION_DAYS="15"
readonly BACKUP_ENABLED="true"
readonly HA_ENABLED="true"
readonly SECURITY_CONTEXT_ENABLED="true"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

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

# Verify prerequisites
verify_prerequisites() {
    local prerequisites=("kubectl" "helm")
    
    for cmd in "${prerequisites[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Verify Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    }
}

# Setup Prometheus with enhanced security
setup_prometheus() {
    local namespace="$1"
    local values_file="$2"
    local retention_days="$3"
    local enable_remote_write="$4"
    
    log_info "Setting up Prometheus v${PROMETHEUS_VERSION}"
    
    # Add Prometheus Helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply RBAC policies
    kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus-server
rules:
  - apiGroups: [""]
    resources: ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
    verbs: ["get", "list", "watch"]
EOF
    
    # Install Prometheus with security context
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$namespace" \
        --version "$PROMETHEUS_VERSION" \
        --values "$values_file" \
        --set server.retention="$retention_days"d \
        --set server.securityContext.runAsUser=65534 \
        --set server.securityContext.runAsNonRoot=true \
        --set server.remoteWrite.enabled="$enable_remote_write" \
        --wait
        
    # Verify installation
    if ! kubectl rollout status statefulset/prometheus-server -n "$namespace"; then
        log_error "Prometheus installation failed"
        return 1
    fi
    
    log_info "Prometheus setup completed successfully"
}

# Setup Grafana with automated dashboard provisioning
setup_grafana() {
    local namespace="$1"
    local values_file="$2"
    local admin_password="$3"
    local dashboard_files=("${@:4}")
    
    log_info "Setting up Grafana v${GRAFANA_VERSION}"
    
    # Add Grafana Helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Create secret for admin password
    kubectl create secret generic grafana-admin \
        --from-literal=admin-password="$admin_password" \
        --namespace "$namespace" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Grafana
    helm upgrade --install grafana grafana/grafana \
        --namespace "$namespace" \
        --version "$GRAFANA_VERSION" \
        --values "$values_file" \
        --set admin.existingSecret=grafana-admin \
        --set securityContext.runAsUser=472 \
        --set securityContext.runAsGroup=472 \
        --set persistence.enabled=true \
        --wait
        
    # Import dashboards
    for dashboard in "${dashboard_files[@]}"; do
        kubectl create configmap "grafana-dashboard-$(basename "$dashboard" .json)" \
            --from-file="$dashboard" \
            --namespace "$namespace" \
            --dry-run=client -o yaml | kubectl apply -f -
    done
    
    # Verify installation
    if ! kubectl rollout status deployment/grafana -n "$namespace"; then
        log_error "Grafana installation failed"
        return 1
    }
    
    log_info "Grafana setup completed successfully"
}

# Setup Alertmanager with enhanced notification capabilities
setup_alertmanager() {
    local namespace="$1"
    local config_file="$2"
    local notification_config="$3"
    local template_files=("${@:4}")
    
    log_info "Setting up Alertmanager v${ALERTMANAGER_VERSION}"
    
    # Validate configuration
    if ! yq eval . "$config_file" > /dev/null; then
        log_error "Invalid Alertmanager configuration"
        return 1
    }
    
    # Create ConfigMap for templates
    for template in "${template_files[@]}"; do
        kubectl create configmap "alertmanager-template-$(basename "$template" .tmpl)" \
            --from-file="$template" \
            --namespace "$namespace" \
            --dry-run=client -o yaml | kubectl apply -f -
    done
    
    # Install Alertmanager
    helm upgrade --install alertmanager prometheus-community/alertmanager \
        --namespace "$namespace" \
        --version "$ALERTMANAGER_VERSION" \
        --set configFile="$config_file" \
        --set notificationConfig="$notification_config" \
        --set securityContext.runAsUser=65534 \
        --set securityContext.runAsNonRoot=true \
        --wait
        
    # Verify installation
    if ! kubectl rollout status statefulset/alertmanager -n "$namespace"; then
        log_error "Alertmanager installation failed"
        return 1
    }
    
    log_info "Alertmanager setup completed successfully"
}

# Verify monitoring stack
verify_monitoring() {
    local namespace="$1"
    local results=()
    
    log_info "Verifying monitoring stack components"
    
    # Check Prometheus targets
    if kubectl exec -n "$namespace" prometheus-server-0 -- \
        wget -qO- http://localhost:9090/-/ready | grep -q "Prometheus is Ready"; then
        results+=("Prometheus: OK")
    else
        results+=("Prometheus: FAIL")
    fi
    
    # Check Grafana health
    if kubectl exec -n "$namespace" deploy/grafana -- \
        wget -qO- http://localhost:3000/api/health | grep -q "ok"; then
        results+=("Grafana: OK")
    else
        results+=("Grafana: FAIL")
    fi
    
    # Check Alertmanager
    if kubectl exec -n "$namespace" alertmanager-0 -- \
        wget -qO- http://localhost:9093/-/ready | grep -q "OK"; then
        results+=("Alertmanager: OK")
    else
        results+=("Alertmanager: FAIL")
    fi
    
    # Print results
    printf "\nMonitoring Stack Health Check Results:\n"
    printf "%s\n" "${results[@]}"
    
    # Return overall status
    if [[ "${results[*]}" =~ "FAIL" ]]; then
        return 1
    fi
    return 0
}

# Main setup function
main() {
    local namespace="${1:-$MONITORING_NAMESPACE}"
    
    # Verify prerequisites
    verify_prerequisites
    
    # Create monitoring namespace
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    
    # Setup components
    setup_prometheus "$namespace" \
        "../monitoring/prometheus/prometheus.yml" \
        "$RETENTION_DAYS" \
        "true" || exit 1
        
    setup_grafana "$namespace" \
        "../monitoring/grafana/datasources.yml" \
        "${GRAFANA_ADMIN_PASSWORD:-admin}" \
        "../monitoring/grafana/dashboards/"* || exit 1
        
    setup_alertmanager "$namespace" \
        "../monitoring/alertmanager/alertmanager.yml" \
        "../monitoring/alertmanager/notification.yml" \
        "../monitoring/alertmanager/templates/"* || exit 1
    
    # Verify setup
    if verify_monitoring "$namespace"; then
        log_info "Monitoring stack setup completed successfully"
    else
        log_error "Monitoring stack verification failed"
        exit 1
    fi
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi