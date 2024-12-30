# Terraform variables definition file for the networking module
# Version: ~> 1.0

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR block must be a valid IPv4 CIDR notation"
  }
}

variable "environment" {
  description = "Environment name for resource tagging"
  type        = string

  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "availability_zones" {
  description = "List of availability zones for subnet distribution"
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones must be specified for high availability"
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of private subnet CIDRs must match number of availability zones"
  }

  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All private subnet CIDR blocks must be valid IPv4 CIDR notations"
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of public subnet CIDRs must match number of availability zones"
  }

  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : can(cidrhost(cidr, 0))])
    error_message = "All public subnet CIDR blocks must be valid IPv4 CIDR notations"
  }
}

variable "enable_nat_gateway" {
  description = "Flag to enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Flag to use a single NAT Gateway instead of one per AZ"
  type        = bool
  default     = false
}

variable "enable_dns_hostnames" {
  description = "Flag to enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}

variable "enable_dns_support" {
  description = "Flag to enable DNS support in the VPC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Resource tags for the networking components"
  type        = map(string)
  default     = {}

  validation {
    condition     = can(lookup(var.tags, "ManagedBy", null))
    error_message = "Tags must include a 'ManagedBy' key for resource management tracking"
  }
}