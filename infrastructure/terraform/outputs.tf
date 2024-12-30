# Network Infrastructure Outputs
output "vpc_id" {
  description = "ID of the VPC created for the Task Management System"
  value       = module.networking.vpc_id
  sensitive   = false
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC for network planning"
  value       = module.networking.vpc_cidr
  sensitive   = false
}

output "availability_zones" {
  description = "List of availability zones used for multi-AZ deployment"
  value       = module.networking.availability_zones
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for application and database tiers"
  value       = module.networking.private_subnet_ids
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancers and NAT gateways"
  value       = module.networking.public_subnet_ids
  sensitive   = false
}

# Security Group Outputs
output "security_groups" {
  description = "Map of security group IDs for different application tiers"
  value = {
    alb = module.networking.alb_security_group_id
    app = module.networking.app_security_group_id
    db  = module.networking.db_security_group_id
  }
  sensitive = true
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint URL for Kubernetes API access"
  value       = module.compute.eks_cluster_endpoint
  sensitive   = false
}

output "eks_cluster_ca_data" {
  description = "Certificate authority data for EKS cluster authentication"
  value       = module.compute.eks_cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_version" {
  description = "Version of the EKS cluster for compatibility checks"
  value       = module.compute.eks_cluster_version
  sensitive   = false
}

output "eks_node_groups" {
  description = "Details of EKS node groups including capacity and scaling configurations"
  value       = module.compute.eks_node_groups
  sensitive   = false
}

# Database Outputs
output "rds_endpoint" {
  description = "Primary PostgreSQL RDS instance endpoint for application connection"
  value       = module.database.db_endpoint
  sensitive   = false
}

output "rds_read_replica_endpoints" {
  description = "List of PostgreSQL read replica endpoints for read scaling"
  value       = module.database.db_read_replica_endpoints
  sensitive   = false
}

# Cache Outputs
output "redis_endpoint" {
  description = "Primary Redis cluster endpoint for caching layer"
  value       = module.database.redis_endpoint
  sensitive   = false
}

output "redis_read_endpoints" {
  description = "Redis read replica endpoints for cache scaling"
  value       = module.database.redis_read_endpoints
  sensitive   = false
}

# Monitoring Outputs
output "monitoring_endpoints" {
  description = "Map of monitoring endpoints for various system metrics"
  value       = module.database.monitoring_endpoints
  sensitive   = false
}

# VPC Endpoint Outputs
output "vpc_endpoints" {
  description = "Map of VPC endpoint IDs for AWS service access"
  value = {
    s3        = module.networking.vpc_endpoint_s3_id
    dynamodb  = module.networking.vpc_endpoint_dynamodb_id
  }
  sensitive = false
}

# Route Table Outputs
output "route_tables" {
  description = "Map of route table IDs for network traffic management"
  value = {
    public  = module.networking.public_route_table_id
    private = module.networking.private_route_table_ids
  }
  sensitive = false
}