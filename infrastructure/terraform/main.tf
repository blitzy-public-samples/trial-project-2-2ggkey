# Task Management System Infrastructure
# Terraform >= 1.0.0
# AWS Provider >= 5.0.0

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws" # version ~> 5.0
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes" # version ~> 2.23
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm" # version ~> 2.11
      version = "~> 2.11"
    }
  }

  # Backend configuration should be provided via backend.tf
  backend "s3" {}
}

# Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.default_tags
  }
}

# Local Variables
locals {
  common_tags = {
    Project            = "TaskManagementSystem"
    Environment        = var.environment
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    ComplianceLevel   = "SOC2"
    DataClassification = "Sensitive"
  }

  # Environment-specific configurations
  is_production = var.environment == "prod"
  
  # High availability settings
  multi_az_enabled = local.is_production
  backup_retention = local.is_production ? 35 : 7
}

# Network Infrastructure
module "networking" {
  source = "./modules/networking"

  vpc_cidr            = var.vpc_cidr
  environment         = var.environment
  availability_zones  = var.availability_zones
  
  # Subnet Configuration
  private_subnet_cidrs = [for i, az in var.availability_zones : 
    cidrsubnet(var.vpc_cidr, 4, i)]
  public_subnet_cidrs  = [for i, az in var.availability_zones : 
    cidrsubnet(var.vpc_cidr, 4, i + length(var.availability_zones))]
  
  # Security Features
  enable_nat_gateway   = true
  single_nat_gateway   = !local.is_production
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Enhanced Security
  enable_flow_logs     = true
  
  tags = local.common_tags
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"

  cluster_name    = "tms-${var.environment}"
  cluster_version = var.eks_cluster_version
  
  vpc_id          = module.networking.vpc_id
  subnet_ids      = module.networking.private_subnet_ids
  
  # Node Group Configuration
  node_groups = {
    application = {
      desired_size = local.is_production ? 3 : 2
      min_size     = local.is_production ? 2 : 1
      max_size     = local.is_production ? 10 : 4
      instance_types = var.node_instance_types
    }
  }
  
  # Security Configuration
  enable_irsa                    = true
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  cluster_endpoint_public_access_cidrs = var.allowed_cidr_blocks
  
  # Add-ons
  enable_cluster_autoscaler = true
  enable_metrics_server     = true
  enable_prometheus        = true
  
  tags = local.common_tags
}

# Database Infrastructure
module "database" {
  source = "./modules/rds"

  identifier        = "tms-${var.environment}"
  engine           = "postgres"
  engine_version   = "14"
  instance_class   = var.db_instance_class
  
  allocated_storage     = local.is_production ? 100 : 20
  max_allocated_storage = local.is_production ? 1000 : 100
  
  # High Availability Configuration
  multi_az             = local.multi_az_enabled
  backup_retention_period = local.backup_retention
  
  # Network Configuration
  subnet_ids         = module.networking.private_subnet_ids
  vpc_security_group_ids = [module.networking.db_security_group_id]
  
  # Security Configuration
  storage_encrypted = true
  kms_key_id       = module.kms.database_key_arn
  
  tags = local.common_tags
}

# Monitoring Infrastructure
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment
  
  # CloudWatch Configuration
  log_retention_days = var.log_retention_days
  enable_detailed_monitoring = var.enable_detailed_monitoring
  
  # Alerting Configuration
  alert_email_endpoints = local.is_production ? var.prod_alert_emails : var.nonprod_alert_emails
  
  # Metrics Configuration
  eks_cluster_name = module.eks.cluster_name
  vpc_id          = module.networking.vpc_id
  
  # Dashboard Configuration
  create_dashboard = true
  dashboard_name   = "TMS-${var.environment}-Dashboard"
  
  tags = local.common_tags
}

# Security Infrastructure
module "security" {
  source = "./modules/security"

  environment = var.environment
  
  # WAF Configuration
  enable_waf = true
  waf_rules = local.is_production ? var.prod_waf_rules : var.nonprod_waf_rules
  
  # GuardDuty Configuration
  enable_guardduty = true
  
  # Security Hub Configuration
  enable_security_hub = local.is_production
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID with enhanced security group associations"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint with RBAC and network policies"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.monitoring.dashboard_url
}