# Task Management System Infrastructure Variables
# Terraform >= 1.0.0
# AWS Provider >= 4.0.0

# Environment Configuration
variable "environment" {
  description = "Deployment environment identifier (dev, staging, prod) for environment-specific configurations"
  type        = string
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod."
  }
}

# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for infrastructure deployment with high availability support"
  type        = string
  default     = "us-west-2"
  
  validation {
    condition     = can(regex("^us-(east|west)-[1-2]$", var.aws_region))
    error_message = "Region must be us-east-1, us-east-2, us-west-1, or us-west-2."
  }
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC network segmentation"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of AWS availability zones for high availability deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for high availability."
  }
}

# Compute Configuration
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.27"
  
  validation {
    condition     = can(regex("^1\\.(2[6-7])$", var.eks_cluster_version))
    error_message = "EKS version must be 1.26 or 1.27."
  }
}

variable "node_instance_types" {
  description = "EC2 instance types for EKS node groups"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
  
  validation {
    condition     = length([for t in var.node_instance_types : t if can(regex("^t3\\.(medium|large)$", t))]) == length(var.node_instance_types)
    error_message = "Instance types must be t3.medium or t3.large."
  }
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class for PostgreSQL database"
  type        = string
  default     = "db.t3.medium"
  
  validation {
    condition     = can(regex("^db\\.t3\\.(micro|small|medium|large)$", var.db_instance_class))
    error_message = "DB instance class must be db.t3.micro, small, medium, or large."
  }
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated database backups"
  type        = number
  default     = 7
  
  validation {
    condition     = var.db_backup_retention_days >= 7 && var.db_backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}

# Monitoring Configuration
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring for EC2 instances"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be one of the allowed CloudWatch values."
  }
}

# Tags Configuration
variable "default_tags" {
  description = "Default tags to apply to all resources"
  type        = map(string)
  default     = {
    ManagedBy = "terraform"
    Project   = "task-management-system"
  }
  
  validation {
    condition     = length(var.default_tags) > 0
    error_message = "At least one default tag must be specified."
  }
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the infrastructure"
  type        = list(string)
  
  validation {
    condition     = length([for cidr in var.allowed_cidr_blocks : cidr if can(cidrhost(cidr, 0))]) == length(var.allowed_cidr_blocks)
    error_message = "All CIDR blocks must be valid IPv4 CIDR notation."
  }
}