# Provider Configuration for Task Management System
# Terraform >= 1.5.0
# Last Updated: 2024

terraform {
  # Terraform version constraint ensuring enterprise-ready features
  required_version = ">= 1.5.0"

  # Required providers with strict version constraints for stability
  required_providers {
    # AWS Provider v5.0 - Enterprise-grade cloud infrastructure
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Kubernetes Provider v2.23 - EKS cluster management
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }

    # Helm Provider v2.11 - Application deployment management
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  # Enterprise-grade resource tagging strategy
  default_tags {
    tags = {
      Project             = "TaskManagementSystem"
      ManagedBy          = "Terraform"
      Environment        = var.environment
      SecurityCompliance = "SOC2"
      BackupPolicy       = "Daily"
      LastUpdated        = formatdate("YYYY-MM-DD", timestamp())
      CostCenter         = "TMS-${var.environment}"
      DataClassification = "Confidential"
    }
  }
}

# Kubernetes Provider Configuration for EKS
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token

  # AWS IAM Authenticator configuration for secure cluster access
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      var.cluster_name
    ]
  }
}

# Helm Provider Configuration for application deployment
provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.cluster.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.cluster.token

    # AWS IAM Authenticator configuration matching Kubernetes provider
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        var.cluster_name
      ]
    }
  }
}

# Data sources for EKS cluster authentication
data "aws_eks_cluster" "cluster" {
  name = var.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = var.cluster_name
}