# Task Management System - Staging Environment Configuration
# Terraform >= 1.0.0
# AWS Provider ~> 5.0

terraform {
  required_version = ">= 1.0.0"

  # S3 Backend Configuration for State Management
  backend "s3" {
    bucket         = "taskmanager-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Local Variables
locals {
  environment = "staging"
  common_tags = {
    Project       = "TaskManagementSystem"
    Environment   = "staging"
    ManagedBy     = "Terraform"
    CostCenter    = "Engineering"
    SecurityLevel = "High"
  }
}

# Main Infrastructure Module
module "main" {
  source = "../../"

  # Environment Configuration
  environment = local.environment
  aws_region  = "us-west-2"

  # Network Configuration
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["us-west-2a", "us-west-2b"]

  # EKS Configuration - Scaled down for staging
  eks_cluster_version = "1.27"
  node_instance_types = ["t3.medium"]
  node_group_min_size = 2
  node_group_max_size = 4

  # Database Configuration - Optimized for staging
  db_instance_class        = "db.t3.medium"
  db_backup_retention_days = 7

  # Redis Configuration - Minimal for staging
  redis_node_type       = "cache.t3.medium"
  redis_num_cache_nodes = 2

  # Monitoring Configuration
  monitoring_retention_days = 30
  enable_detailed_monitoring = true

  # Network Features
  enable_nat_gateway    = true
  single_nat_gateway    = true  # Cost optimization for staging
  enable_vpn_gateway    = false
  enable_cross_zone_lb  = true

  # Security Configuration
  allowed_cidr_blocks = [
    "10.0.0.0/8",     # Internal network
    "172.16.0.0/12"   # VPN network
  ]

  # WAF Configuration for staging
  waf_rules = {
    ip_rate_limit = 2000
    rule_priority = 100
  }

  # Alerting Configuration
  nonprod_alert_emails = [
    "staging-alerts@taskmanager.com"
  ]

  # Tags
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC ID for the staging environment"
  value       = module.main.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for staging"
  value       = module.main.eks_cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "RDS database endpoint for staging"
  value       = module.main.database_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cache endpoint for staging"
  value       = module.main.redis_endpoint
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "CloudWatch monitoring dashboard URL"
  value       = module.main.monitoring_dashboard_url
}