#!/usr/bin/env bash

# Task Management System Deployment Script v1.0.0
# Purpose: Enterprise-grade deployment automation for microservices
# Dependencies: kubectl v1.27+, aws-cli 2.0+
# Last Updated: 2024

set -euo pipefail
IFS=$'\n\t'

# Global Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE="task-management"
KUBECTL_CONTEXT="task-management-${ENVIRONMENT}"
DEPLOYMENT_TIMEOUT="300s"
HEALTH_CHECK_INTERVAL="10s"
MAX_RETRY_ATTEMPTS="5"
ROLLBACK_THRESHOLD="25"

# Logging Configuration
LOG_FILE="/var/log/deployments/deploy-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function with timestamps
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    local exit_code=$?
    local line_number=$1
    log "ERROR" "Failed at line $line_number with exit code $exit_code"
    rollback_deployment "all"
    exit $exit_code
}

trap 'handle_error ${LINENO}' ERR

# Check deployment prerequisites
check_prerequisites() {
    log "INFO" "Checking deployment prerequisites..."

    # Verify kubectl version
    local kubectl_version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! $kubectl_version =~ v1\.2[7-9]\. && ! $kubectl_version =~ v1\.[3-9][0-9]\. ]]; then
        log "ERROR" "kubectl version $kubectl_version is not supported. Required: >= v1.27"
        return 1
    }

    # Verify AWS CLI
    if ! aws --version >/dev/null 2>&1; then
        log "ERROR" "AWS CLI is not installed or not in PATH"
        return 1
    }

    # Check cluster connectivity
    if ! kubectl auth can-i get deployments --namespace="$NAMESPACE" >/dev/null 2>&1; then
        log "ERROR" "Insufficient permissions in namespace $NAMESPACE"
        return 1
    }

    # Verify namespace exists
    if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
        log "INFO" "Creating namespace $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    }

    # Authenticate with AWS ECR
    log "INFO" "Authenticating with AWS ECR..."
    aws ecr get-login-password --region "${AWS_REGION}" | \
        kubectl create secret docker-registry ecr-secret \
        --docker-server="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com" \
        --docker-username=AWS \
        --docker-password=stdin \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Deploy a service with health checks
deploy_service() {
    local service_name=$1
    local deployment_file=$2
    local deployment_id
    deployment_id=$(date +%s)
    
    log "INFO" "Deploying $service_name (ID: $deployment_id)..."

    # Apply resource quotas
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ${service_name}-quota
  namespace: $NAMESPACE
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
EOF

    # Initialize deployment
    kubectl apply -f "$deployment_file" --namespace="$NAMESPACE"
    
    # Wait for rollout
    if ! kubectl rollout status deployment/"$service_name" \
        --namespace="$NAMESPACE" \
        --timeout="$DEPLOYMENT_TIMEOUT"; then
        log "ERROR" "Deployment of $service_name failed"
        return 1
    }

    # Verify health
    local attempts=0
    while [ $attempts -lt "$MAX_RETRY_ATTEMPTS" ]; do
        if health_check "$service_name"; then
            log "INFO" "$service_name deployment successful"
            return 0
        fi
        attempts=$((attempts + 1))
        sleep "$HEALTH_CHECK_INTERVAL"
    done

    log "ERROR" "$service_name health check failed after $MAX_RETRY_ATTEMPTS attempts"
    return 1
}

# Health check function
health_check() {
    local service_name=$1
    local ready_pods
    local total_pods
    
    ready_pods=$(kubectl get deployment "$service_name" \
        --namespace="$NAMESPACE" \
        -o jsonpath='{.status.readyReplicas}')
    total_pods=$(kubectl get deployment "$service_name" \
        --namespace="$NAMESPACE" \
        -o jsonpath='{.spec.replicas}')

    if [ "$ready_pods" != "$total_pods" ]; then
        log "WARN" "$service_name: $ready_pods/$total_pods pods ready"
        return 1
    fi

    # Check endpoints
    if ! kubectl get endpoints "$service_name" \
        --namespace="$NAMESPACE" \
        -o jsonpath='{.subsets[*].addresses[*]}' | grep -q .; then
        log "WARN" "$service_name: No endpoints available"
        return 1
    fi

    return 0
}

# Rollback function
rollback_deployment() {
    local service_name=$1
    log "WARN" "Initiating rollback for $service_name"

    if [ "$service_name" = "all" ]; then
        for svc in api-gateway task-service file-service; do
            kubectl rollout undo deployment/"$svc" --namespace="$NAMESPACE" || true
        done
    else
        kubectl rollout undo deployment/"$service_name" --namespace="$NAMESPACE"
    fi

    log "INFO" "Rollback completed for $service_name"
}

# Main deployment orchestration
main() {
    log "INFO" "Starting deployment in $ENVIRONMENT environment"

    # Check prerequisites
    if ! check_prerequisites; then
        log "ERROR" "Prerequisites check failed"
        exit 1
    }

    # Deploy API Gateway
    if ! deploy_service "api-gateway" "src/backend/k8s/api-gateway-deployment.yml"; then
        log "ERROR" "API Gateway deployment failed"
        exit 1
    fi

    # Deploy Task Service
    if ! deploy_service "task-service" "src/backend/k8s/task-service-deployment.yml"; then
        log "ERROR" "Task Service deployment failed"
        exit 1
    fi

    # Deploy File Service
    if ! deploy_service "file-service" "src/backend/k8s/file-service-deployment.yml"; then
        log "ERROR" "File Service deployment failed"
        exit 1
    fi

    log "INFO" "Deployment completed successfully"
    
    # Export deployment status
    cat > /tmp/deploy_status.json <<EOF
{
    "exit_code": 0,
    "deployment_details": {
        "environment": "$ENVIRONMENT",
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
        "services": {
            "api_gateway": "$(kubectl get deployment api-gateway -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')/$(kubectl get deployment api-gateway -n $NAMESPACE -o jsonpath='{.spec.replicas}')",
            "task_service": "$(kubectl get deployment task-service -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')/$(kubectl get deployment task-service -n $NAMESPACE -o jsonpath='{.spec.replicas}')",
            "file_service": "$(kubectl get deployment file-service -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')/$(kubectl get deployment file-service -n $NAMESPACE -o jsonpath='{.spec.replicas}')"
        }
    },
    "health_metrics": {
        "api_gateway": $(kubectl get deployment api-gateway -n $NAMESPACE -o json),
        "task_service": $(kubectl get deployment task-service -n $NAMESPACE -o json),
        "file_service": $(kubectl get deployment file-service -n $NAMESPACE -o json)
    }
}
EOF
}

# Execute main function
main "$@"