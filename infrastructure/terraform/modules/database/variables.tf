# Environment configuration
variable "environment" {
  description = "Environment name (dev/staging/prod) for resource naming and tagging"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# PostgreSQL RDS Configuration
variable "db_instance_class" {
  description = "RDS instance class for PostgreSQL database optimized for 1000+ concurrent users"
  type        = string
  default     = "db.r5.xlarge"
  validation {
    condition     = can(regex("^db\\.(t3|r5|r6|m5|m6)\\.(large|xlarge|2xlarge|4xlarge)$", var.db_instance_class))
    error_message = "Invalid RDS instance class specified. Must be t3, r5, r6, m5, or m6 series"
  }
}

variable "db_allocated_storage" {
  description = "Initial storage allocation for RDS instance in GB with performance optimization"
  type        = number
  default     = 100
  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 16384
    error_message = "Storage must be between 20GB and 16TB"
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum storage allocation for RDS autoscaling in GB with cost controls"
  type        = number
  default     = 1000
  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage && var.db_max_allocated_storage <= 16384
    error_message = "Max storage must be between initial storage and 16TB"
  }
}

variable "db_name" {
  description = "Name of the PostgreSQL database to create with strict naming conventions"
  type        = string
  default     = "taskmanager"
  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{2,63}$", var.db_name))
    error_message = "Database name must be 3-63 characters, start with a letter, and contain only lowercase letters, numbers, and underscores"
  }
}

variable "db_username" {
  description = "Master username for PostgreSQL database with enhanced security requirements"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{4,31}$", var.db_username))
    error_message = "Username must be 5-32 characters, start with a letter, and contain only lowercase letters, numbers, and underscores"
  }
}

variable "db_password" {
  description = "Master password for PostgreSQL database with strict complexity requirements"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$", var.db_password))
    error_message = "Password must be at least 12 characters and include uppercase, lowercase, numbers, and special characters"
  }
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability with automated failover"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Number of days to retain automated backups with compliance considerations"
  type        = number
  default     = 35
  validation {
    condition     = var.backup_retention_period >= 7 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 7 and 35 days for compliance"
  }
}

variable "vpc_security_group_ids" {
  description = "List of VPC security group IDs to associate with the database instances for network isolation"
  type        = list(string)
}

variable "db_subnet_group_name" {
  description = "Name of DB subnet group for RDS and Redis placement in private subnets"
  type        = string
}

# Redis Cache Configuration
variable "redis_node_type" {
  description = "Redis node instance type optimized for high-throughput caching"
  type        = string
  default     = "cache.r5.large"
  validation {
    condition     = can(regex("^cache\\.(t3|r5|r6|m5|m6)\\.(medium|large|xlarge)$", var.redis_node_type))
    error_message = "Invalid Redis node type specified. Must be t3, r5, r6, m5, or m6 series"
  }
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the Redis cluster for distributed caching"
  type        = number
  default     = 3
  validation {
    condition     = var.redis_num_cache_nodes >= 2 && var.redis_num_cache_nodes <= 6
    error_message = "Number of Redis nodes must be between 2 and 6 for HA configuration"
  }
}

variable "redis_parameter_group_family" {
  description = "Redis parameter group family with version compatibility"
  type        = string
  default     = "redis6.x"
  validation {
    condition     = can(regex("^redis[56]\\.x$", var.redis_parameter_group_family))
    error_message = "Redis parameter group family must be redis5.x or redis6.x"
  }
}

variable "tags" {
  description = "Tags to apply to all resources for resource management and cost allocation"
  type        = map(string)
  default     = {}
}