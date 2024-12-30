# Terraform AWS EKS Cluster Variables
# Version: ~> 1.0

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster for Task Management System"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where EKS cluster will be deployed for network isolation"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for EKS node groups to ensure multi-AZ deployment and high availability"
}

variable "node_group_instance_types" {
  type        = list(string)
  description = "List of EC2 instance types for EKS node groups to support production workloads"
  default     = ["t3.xlarge", "t3.2xlarge"]  # Production-grade instance types with good CPU/memory ratio
}

variable "node_group_desired_size" {
  type        = number
  description = "Desired number of nodes in EKS node group for optimal performance and high availability"
  default     = 3  # Minimum nodes for production HA setup
}

variable "node_group_min_size" {
  type        = number
  description = "Minimum number of nodes in EKS node group to maintain service availability"
  default     = 3  # Ensures HA across availability zones
}

variable "node_group_max_size" {
  type        = number
  description = "Maximum number of nodes in EKS node group for auto-scaling during peak loads"
  default     = 10  # Allows for significant scaling during high demand
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for EKS cluster (must be 1.27 or higher per requirements)"
  default     = "1.27"  # Minimum required version per technical specification
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for EKS cluster and node groups for organization and cost tracking"
  default = {
    Environment = "production"
    ManagedBy   = "terraform"
    Project     = "task-management-system"
    Owner       = "platform-team"
  }
}