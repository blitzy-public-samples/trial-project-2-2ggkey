# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "task_manager" {
  identifier = "${var.environment}-task-manager-db"
  
  # Engine Configuration
  engine         = "postgres"
  engine_version = "14"
  
  # Instance Configuration
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  
  # Database Configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  
  # High Availability Configuration
  multi_az = var.multi_az
  
  # Backup Configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # Network Configuration
  vpc_security_group_ids = var.vpc_security_group_ids
  db_subnet_group_name   = var.db_subnet_group_name
  
  # Security Configuration
  storage_encrypted = true
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.environment}-task-manager-db-final-${formatdate("YYYYMMDD-hhmmss", timestamp())}"
  copy_tags_to_snapshot = true
  
  # Performance and Monitoring Configuration
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = var.monitoring_role_arn
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  
  # Maintenance Configuration
  auto_minor_version_upgrade = true
  
  # Tags
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-task-manager-db"
      Environment = var.environment
      Service     = "task-manager"
      Managed_by  = "terraform"
    }
  )
}

# Redis ElastiCache Cluster
resource "aws_elasticache_cluster" "task_manager_cache" {
  cluster_id           = "${var.environment}-task-manager-cache"
  
  # Engine Configuration
  engine               = "redis"
  engine_version       = "6.x"
  parameter_group_name = aws_elasticache_parameter_group.redis_params.name
  
  # Instance Configuration
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  port                = 6379
  
  # Network Configuration
  security_group_ids  = var.vpc_security_group_ids
  subnet_group_name   = var.redis_subnet_group_name
  
  # High Availability Configuration
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Security Configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  
  # Backup Configuration
  snapshot_retention_limit = 7
  snapshot_window         = "02:00-03:00"
  maintenance_window      = "sun:05:00-sun:06:00"
  
  # Monitoring Configuration
  notification_topic_arn = var.notification_topic_arn
  
  # Maintenance Configuration
  apply_immediately = false
  
  # Tags
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-task-manager-cache"
      Environment = var.environment
      Service     = "task-manager"
      Managed_by  = "terraform"
    }
  )
}

# Redis Parameter Group
resource "aws_elasticache_parameter_group" "redis_params" {
  family = var.redis_parameter_group_family
  name   = "${var.environment}-task-manager-redis-params"
  
  description = "Custom Redis parameters for Task Manager application"
  
  # Redis Performance Optimization Parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-task-manager-redis-params"
      Environment = var.environment
      Service     = "task-manager"
      Managed_by  = "terraform"
    }
  )
}

# CloudWatch Metric Alarms for RDS
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.environment}-task-manager-db-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors RDS CPU utilization"
  alarm_actions      = [var.notification_topic_arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.task_manager.id
  }
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-task-manager-db-cpu-alarm"
      Environment = var.environment
      Service     = "task-manager"
      Managed_by  = "terraform"
    }
  )
}

# CloudWatch Metric Alarms for Redis
resource "aws_cloudwatch_metric_alarm" "cache_cpu" {
  alarm_name          = "${var.environment}-task-manager-cache-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ElastiCache"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors Redis CPU utilization"
  alarm_actions      = [var.notification_topic_arn]
  
  dimensions = {
    CacheClusterId = aws_elasticache_cluster.task_manager_cache.id
  }
  
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-task-manager-cache-cpu-alarm"
      Environment = var.environment
      Service     = "task-manager"
      Managed_by  = "terraform"
    }
  )
}