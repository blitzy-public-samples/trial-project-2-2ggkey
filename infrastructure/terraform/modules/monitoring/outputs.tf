# Core monitoring namespace output
output "monitoring_namespace" {
  description = "Kubernetes namespace where the monitoring stack is deployed. Used for resource isolation and access control."
  value       = kubernetes_namespace.monitoring.metadata[0].name
  sensitive   = false
}

# Prometheus endpoint output
output "prometheus_endpoint" {
  description = <<-EOT
    HTTP(S) endpoint URL for accessing Prometheus metrics and querying interface.
    Format: https://<domain>/prometheus
    Note: Ensure proper authentication and TLS is configured for production use.
  EOT
  value       = helm_release.prometheus.status[0].notes
  sensitive   = false
}

# Grafana endpoint and credentials output
output "grafana_endpoint" {
  description = <<-EOT
    HTTP(S) endpoint URL for accessing Grafana dashboards and visualization interface.
    Format: https://<domain>/grafana
    Note: Access requires authentication with admin credentials.
  EOT
  value       = helm_release.grafana.status[0].notes
  sensitive   = false
}

output "grafana_admin_password" {
  description = <<-EOT
    Administrative password for Grafana dashboard access.
    Security Notes:
    - Rotate this password regularly
    - Store securely in a password manager
    - Restrict access to authorized personnel only
  EOT
  value       = var.grafana_admin_password
  sensitive   = true
}

# Conditional AlertManager endpoint output
output "alertmanager_endpoint" {
  description = <<-EOT
    HTTP(S) endpoint URL for accessing AlertManager interface when enabled.
    Format: https://<domain>/alertmanager
    Note: Only available when AlertManager is enabled via enable_alertmanager variable.
  EOT
  value       = var.enable_alertmanager ? helm_release.alertmanager[0].status[0].notes : null
  sensitive   = false
}

# Conditional Loki endpoint output
output "loki_endpoint" {
  description = <<-EOT
    HTTP(S) endpoint URL for accessing Loki log aggregation when enabled.
    Format: https://<domain>/loki
    Note: Only available when Loki is enabled via enable_loki variable.
  EOT
  value       = var.enable_loki ? helm_release.loki[0].status[0].notes : null
  sensitive   = false
}

# Conditional Jaeger endpoint output
output "jaeger_endpoint" {
  description = <<-EOT
    HTTP(S) endpoint URL for accessing Jaeger distributed tracing when enabled.
    Format: https://<domain>/jaeger
    Note: Only available when Jaeger is enabled via enable_jaeger variable.
  EOT
  value       = var.enable_jaeger ? helm_release.jaeger[0].status[0].notes : null
  sensitive   = false
}

# Monitoring stack health status output
output "monitoring_stack_health" {
  description = <<-EOT
    Consolidated health status of the monitoring stack components.
    Returns a map of component names to their current health status.
    Use this for monitoring stack health checks and alerting.
  EOT
  value = {
    prometheus    = helm_release.prometheus.status[0].status
    grafana      = helm_release.grafana.status[0].status
    alertmanager = var.enable_alertmanager ? helm_release.alertmanager[0].status[0].status : "disabled"
    loki         = var.enable_loki ? helm_release.loki[0].status[0].status : "disabled"
    jaeger       = var.enable_jaeger ? helm_release.jaeger[0].status[0].status : "disabled"
  }
  sensitive = false
}

# Monitoring resource quotas output
output "monitoring_resource_quotas" {
  description = <<-EOT
    Resource quotas applied to the monitoring namespace.
    Use this to track and manage resource allocation for the monitoring stack.
  EOT
  value = {
    cpu_request    = kubernetes_resource_quota.monitoring_quota.spec[0].hard["requests.cpu"]
    memory_request = kubernetes_resource_quota.monitoring_quota.spec[0].hard["requests.memory"]
    cpu_limit      = kubernetes_resource_quota.monitoring_quota.spec[0].hard["limits.cpu"]
    memory_limit   = kubernetes_resource_quota.monitoring_quota.spec[0].hard["limits.memory"]
    max_pods       = kubernetes_resource_quota.monitoring_quota.spec[0].hard["pods"]
  }
  sensitive = false
}