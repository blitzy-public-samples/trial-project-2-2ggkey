# Core Terraform functionality for variable definitions and validation
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Environment identifier variable with validation
variable "environment" {
  description = "Deployment environment identifier (dev, staging, prod) that determines monitoring stack configuration"
  type        = string

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# VPC ID variable with validation
variable "vpc_id" {
  description = "ID of the VPC where monitoring resources will be deployed for network isolation"
  type        = string

  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC ID starting with vpc-."
  }
}

# Subnet IDs variable with validation
variable "subnet_ids" {
  description = "List of subnet IDs across multiple AZs for high availability deployment"
  type        = list(string)

  validation {
    condition     = can([for subnet in var.subnet_ids : regex("^subnet-[a-z0-9]+$", subnet)])
    error_message = "All subnet IDs must be valid AWS subnet IDs starting with subnet-."
  }
}

# Cluster name variable with validation
variable "cluster_name" {
  description = "Name of the Kubernetes cluster where monitoring stack will be deployed"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$", var.cluster_name))
    error_message = "Cluster name must be a valid DNS-1123 subdomain."
  }
}

# Monitoring namespace variable with validation
variable "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring stack isolation"
  type        = string
  default     = "monitoring"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$", var.monitoring_namespace))
    error_message = "Monitoring namespace must be a valid Kubernetes namespace name."
  }
}

# Prometheus retention days variable with validation
variable "prometheus_retention_days" {
  description = "Number of days to retain Prometheus metrics data"
  type        = number
  default     = 15

  validation {
    condition     = var.prometheus_retention_days >= 1 && var.prometheus_retention_days <= 90
    error_message = "Prometheus retention days must be between 1 and 90 days."
  }
}

# Prometheus scrape interval variable with validation
variable "prometheus_scrape_interval" {
  description = "Interval at which Prometheus scrapes metrics from targets"
  type        = string
  default     = "15s"

  validation {
    condition     = can(regex("^[0-9]+(s|m)$", var.prometheus_scrape_interval))
    error_message = "Prometheus scrape interval must be a valid time duration (e.g., 15s, 1m)."
  }
}

# Grafana admin password variable with validation
variable "grafana_admin_password" {
  description = "Admin password for Grafana dashboard access"
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{12,}$", var.grafana_admin_password))
    error_message = "Grafana admin password must be at least 12 characters and include at least one letter, one number, and one special character."
  }
}

# AlertManager enable/disable flag
variable "enable_alertmanager" {
  description = "Flag to enable/disable AlertManager deployment"
  type        = bool
  default     = true
}

# Loki enable/disable flag
variable "enable_loki" {
  description = "Flag to enable/disable Loki deployment for log aggregation"
  type        = bool
  default     = true
}

# Jaeger enable/disable flag
variable "enable_jaeger" {
  description = "Flag to enable/disable Jaeger deployment for distributed tracing"
  type        = bool
  default     = true
}

# Storage class variable with validation
variable "storage_class" {
  description = "Storage class to use for persistent volumes in monitoring stack"
  type        = string
  default     = "gp2"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$", var.storage_class))
    error_message = "Storage class name must be a valid Kubernetes storage class name."
  }
}