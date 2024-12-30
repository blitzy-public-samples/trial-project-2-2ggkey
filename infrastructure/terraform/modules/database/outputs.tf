# PostgreSQL RDS Outputs
output "db_endpoint" {
  description = "Connection endpoint for the RDS PostgreSQL instance. Format: <hostname>:<port>. Warning: Contains sensitive connection details."
  value       = aws_db_instance.task_manager.endpoint
  sensitive   = true
}

output "db_address" {
  description = "DNS address of the RDS PostgreSQL instance. Format: <hostname>"
  value       = aws_db_instance.task_manager.address
  sensitive   = true
}

output "db_port" {
  description = "Port number on which the RDS PostgreSQL instance accepts connections"
  value       = aws_db_instance.task_manager.port
  sensitive   = false
}

output "db_maintenance_window" {
  description = "Time window during which database maintenance will be performed. Format: ddd:hh24:mi-ddd:hh24:mi"
  value       = aws_db_instance.task_manager.maintenance_window
  sensitive   = false
}

output "db_backup_window" {
  description = "Daily time range during which automated backups are created. Format: hh24:mi-hh24:mi"
  value       = aws_db_instance.task_manager.backup_window
  sensitive   = false
}

# Redis Cache Cluster Outputs
output "redis_endpoint" {
  description = "Configuration endpoint for the Redis cache cluster. Format: <hostname>:<port>. Warning: Contains sensitive connection details."
  value       = aws_elasticache_cluster.task_manager_cache.configuration_endpoint
  sensitive   = true
}

output "redis_nodes" {
  description = "List of cache nodes in the Redis cluster. Each node contains: {address = string, port = number, id = string}"
  value       = aws_elasticache_cluster.task_manager_cache.cache_nodes
  sensitive   = true
}

output "redis_maintenance_window" {
  description = "Time window during which Redis cluster maintenance will be performed. Format: ddd:hh24:mi-ddd:hh24:mi"
  value       = aws_elasticache_cluster.task_manager_cache.maintenance_window
  sensitive   = false
}

# Additional Metadata Outputs
output "db_resource_id" {
  description = "The RDS resource ID for CloudWatch metrics and other AWS service integrations"
  value       = aws_db_instance.task_manager.resource_id
  sensitive   = false
}

output "db_availability_zone" {
  description = "Availability zone where the primary RDS instance is deployed"
  value       = aws_db_instance.task_manager.availability_zone
  sensitive   = false
}

output "redis_cache_cluster_id" {
  description = "Identifier of the Redis cache cluster for CloudWatch metrics and other AWS service integrations"
  value       = aws_elasticache_cluster.task_manager_cache.cluster_id
  sensitive   = false
}

output "redis_engine_version" {
  description = "Version number of the Redis cache engine"
  value       = aws_elasticache_cluster.task_manager_cache.engine_version
  sensitive   = false
}

output "redis_parameter_group_name" {
  description = "Name of the Redis parameter group used by the cache cluster"
  value       = aws_elasticache_parameter_group.redis_params.name
  sensitive   = false
}