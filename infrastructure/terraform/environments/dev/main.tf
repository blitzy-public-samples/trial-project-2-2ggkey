# Task Management System - Development Environment Configuration
# Terraform >= 1.0.0
# AWS Provider >= 5.0.0

terraform {
  # Backend configuration for state management
  backend "s3" {
    bucket         = "taskmanager-terraform-dev-state"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-dev"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws" # version ~> 5.0
      version = "~> 5.0"
    }
  }
}

# Provider configuration with development-specific tags
provider "aws" {
  region = "us-west-2"
  
  default_tags {
    tags = {
      Environment     = "development"
      Project        = "TaskManagementSystem"
      ManagedBy      = "Terraform"
      SecurityScan   = "daily"
      CostTracking   = "enabled"
      AutoCleanup    = "enabled"
    }
  }
}

# Local variables for development environment
locals {
  environment = "dev"
  common_tags = {
    Environment      = "development"
    Project         = "TaskManagementSystem"
    ManagedBy       = "Terraform"
    SecurityLevel   = "development"
    CostCenter      = "development"
    AutoCleanup     = "enabled"
    BackupRetention = "7days"
  }
}

# Root module configuration for development environment
module "root" {
  source = "../../"

  # Environment Configuration
  environment = "dev"
  aws_region = "us-west-2"

  # Network Configuration
  vpc_cidr = "10.0.0.0/16"
  availability_zones = ["us-west-2a"] # Single AZ for development

  # Compute Configuration
  eks_cluster_version = "1.27"
  node_instance_types = ["t3.medium"] # Cost-effective instance type for development

  # Database Configuration
  db_instance_class = "db.t3.small" # Smaller instance for development
  redis_node_type   = "cache.t3.micro"

  # Monitoring Configuration
  monitoring_retention_days = 7
  enable_monitoring        = true
  enable_cost_alerts      = true
  enable_auto_cleanup     = true

  # Backup Configuration
  backup_retention_days = 7

  # Development-specific Settings
  log_level    = "DEBUG"
  project_name = "TaskManagementSystem-Dev"
}

# Outputs from the root module
output "vpc_id" {
  description = "VPC ID for the development environment"
  value       = module.root.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for development environment"
  value       = module.root.eks_cluster_endpoint
  sensitive   = true
}

output "security_group_ids" {
  description = "Security group IDs for development environment"
  value       = module.root.security_group_ids
  sensitive   = true
}