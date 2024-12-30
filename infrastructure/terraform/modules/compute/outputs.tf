# Output definitions for the EKS cluster and node groups
# Version: ~> 1.0

# EKS Cluster Outputs
output "cluster_id" {
  description = "The unique identifier of the EKS cluster used for container orchestration"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "The HTTPS endpoint URL for the EKS cluster API server used for cluster management and operations"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "The base64 encoded certificate authority data required for secure cluster authentication and communication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

# Node Group Outputs
output "node_group_arn" {
  description = "The Amazon Resource Name (ARN) for the EKS node group used for resource identification and management"
  value       = {
    for k, v in aws_eks_node_group.main : k => v.arn
  }
}

output "node_group_status" {
  description = "The current operational status of the EKS node group for monitoring high availability and scaling conditions"
  value       = {
    for k, v in aws_eks_node_group.main : k => v.status
  }
}

# Additional Cluster Information
output "cluster_security_group_id" {
  description = "The security group ID associated with the EKS cluster control plane"
  value       = aws_security_group.eks_cluster.id
}

output "cluster_role_arn" {
  description = "The ARN of the IAM role used by the EKS cluster"
  value       = aws_iam_role.eks_cluster.arn
}

output "node_role_arn" {
  description = "The ARN of the IAM role used by the EKS node groups"
  value       = aws_iam_role.eks_nodes.arn
}

output "cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_platform_version" {
  description = "The platform version of the EKS cluster"
  value       = aws_eks_cluster.main.platform_version
}

output "cluster_log_group_name" {
  description = "The CloudWatch log group name for EKS cluster logging"
  value       = aws_cloudwatch_log_group.eks.name
}

output "cluster_autoscaling_group_names" {
  description = "The names of the autoscaling groups containing the EKS worker nodes"
  value       = {
    for k, v in aws_eks_node_group.main : k => try(v.resources[0].autoscaling_groups[0].name, null)
  }
}