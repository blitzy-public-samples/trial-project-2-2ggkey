# VPC Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
  sensitive   = false
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
  sensitive   = false
}

# Subnet Outputs with explicit dependency on subnet resources
output "private_subnet_ids" {
  description = "List of private subnet IDs distributed across availability zones"
  value       = aws_subnet.private[*].id
  sensitive   = false

  depends_on = [
    aws_subnet.private
  ]
}

output "public_subnet_ids" {
  description = "List of public subnet IDs distributed across availability zones"
  value       = aws_subnet.public[*].id
  sensitive   = false

  depends_on = [
    aws_subnet.public
  ]
}

# Security Group Outputs with sensitive marking for security considerations
output "alb_security_group_id" {
  description = "Security group ID for the application load balancer"
  value       = aws_security_group.alb.id
  sensitive   = true

  depends_on = [
    aws_security_group.alb
  ]
}

output "app_security_group_id" {
  description = "Security group ID for application servers"
  value       = aws_security_group.app.id
  sensitive   = true

  depends_on = [
    aws_security_group.app
  ]
}

output "db_security_group_id" {
  description = "Security group ID for database instances"
  value       = aws_security_group.db.id
  sensitive   = true

  depends_on = [
    aws_security_group.db
  ]
}

# High Availability Configuration Outputs
output "availability_zones" {
  description = "List of availability zones used for multi-AZ deployment"
  value       = var.availability_zones
  sensitive   = false
}

# Network Configuration Outputs
output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs (if enabled)"
  value       = var.enable_nat_gateway ? aws_nat_gateway.main[*].id : []
  sensitive   = false

  depends_on = [
    aws_nat_gateway.main
  ]
}

output "vpc_endpoint_s3_id" {
  description = "ID of the S3 VPC endpoint for secure AWS service access"
  value       = aws_vpc_endpoint.s3.id
  sensitive   = false

  depends_on = [
    aws_vpc_endpoint.s3
  ]
}

output "vpc_endpoint_dynamodb_id" {
  description = "ID of the DynamoDB VPC endpoint for secure AWS service access"
  value       = aws_vpc_endpoint.dynamodb.id
  sensitive   = false

  depends_on = [
    aws_vpc_endpoint.dynamodb
  ]
}

# Route Table Outputs
output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
  sensitive   = false

  depends_on = [
    aws_route_table.public
  ]
}

output "private_route_table_ids" {
  description = "List of private route table IDs"
  value       = aws_route_table.private[*].id
  sensitive   = false

  depends_on = [
    aws_route_table.private
  ]
}