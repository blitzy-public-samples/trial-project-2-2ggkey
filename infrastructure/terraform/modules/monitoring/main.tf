# Provider configurations
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Create monitoring namespace with security configurations
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = var.monitoring_namespace
    
    labels = {
      name         = "monitoring"
      environment  = var.environment
      managed-by   = "terraform"
      security-tier = "restricted"
    }
    
    annotations = {
      "network.kubernetes.io/policy"  = "restricted"
      "scheduler.alpha.kubernetes.io/node-selector" = "monitoring=true"
    }
  }
}

# Network policies for monitoring namespace
resource "kubernetes_network_policy" "monitoring_default" {
  metadata {
    name      = "monitoring-default"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    pod_selector {
      match_labels = {}
    }

    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = kubernetes_namespace.monitoring.metadata[0].name
          }
        }
      }
    }

    policy_types = ["Ingress"]
  }
}

# Prometheus deployment using Helm
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "45.7.1"  # Specify the version for stability

  values = [
    yamlencode({
      prometheus = {
        prometheusSpec = {
          retention        = "${var.prometheus_retention_days}d"
          scrapeInterval  = var.prometheus_scrape_interval
          replicaCount    = var.environment == "prod" ? 2 : 1
          
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = var.storage_class
                accessModes      = ["ReadWriteOnce"]
                resources = {
                  requests = {
                    storage = "50Gi"
                  }
                }
              }
            }
          }

          securityContext = {
            runAsNonRoot = true
            runAsUser    = 65534
            fsGroup      = 65534
          }
        }
      }

      alertmanager = {
        enabled = var.enable_alertmanager
        alertmanagerSpec = {
          replicaCount = var.environment == "prod" ? 2 : 1
        }
      }

      grafana = {
        adminPassword = var.grafana_admin_password
        persistence = {
          enabled = true
          storageClassName = var.storage_class
          size = "10Gi"
        }
        securityContext = {
          runAsNonRoot = true
          runAsUser    = 472
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Loki deployment for log aggregation
resource "helm_release" "loki" {
  count      = var.enable_loki ? 1 : 0
  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "2.9.10"

  values = [
    yamlencode({
      loki = {
        persistence = {
          enabled = true
          storageClassName = var.storage_class
          size = "50Gi"
        }
        replicas = var.environment == "prod" ? 2 : 1
      }
      promtail = {
        enabled = true
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Jaeger deployment for distributed tracing
resource "helm_release" "jaeger" {
  count      = var.enable_jaeger ? 1 : 0
  name       = "jaeger"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "0.71.3"

  values = [
    yamlencode({
      provisionDataStore = {
        cassandra = false
        elasticsearch = true
      }
      storage = {
        type = "elasticsearch"
      }
      elasticsearch = {
        persistence = {
          enabled = true
          storageClassName = var.storage_class
          size = "50Gi"
        }
      }
      collector = {
        replicaCount = var.environment == "prod" ? 2 : 1
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Resource quotas for monitoring namespace
resource "kubernetes_resource_quota" "monitoring_quota" {
  metadata {
    name      = "monitoring-quota"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "8"
      "requests.memory" = "16Gi"
      "limits.cpu"      = "16"
      "limits.memory"   = "32Gi"
      "pods"           = "50"
    }
  }
}

# Service account for monitoring components
resource "kubernetes_service_account" "monitoring" {
  metadata {
    name      = "monitoring-sa"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    
    annotations = {
      "eks.amazonaws.com/role-arn" = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/monitoring-role"
    }
  }

  automount_service_account_token = true
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# Outputs
output "prometheus_endpoint" {
  description = "Prometheus server endpoint"
  value = "http://prometheus-server.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:9090"
}

output "grafana_endpoint" {
  description = "Grafana dashboard endpoint"
  value = "http://grafana.${kubernetes_namespace.monitoring.metadata[0].name}.svc.cluster.local:3000"
}

output "monitoring_namespace" {
  description = "Monitoring namespace name"
  value = kubernetes_namespace.monitoring.metadata[0].name
}