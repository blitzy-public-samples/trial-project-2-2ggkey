# AWS Provider configuration
# Version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# VPC Resource with enhanced networking features
resource "aws_vpc" "main" {
  cidr_block                       = var.vpc_cidr
  enable_dns_hostnames            = var.enable_dns_hostnames
  enable_dns_support              = var.enable_dns_support
  instance_tenancy                = "default"
  assign_generated_ipv6_cidr_block = true

  tags = merge(
    var.tags,
    {
      Name        = format("%s-vpc", var.environment)
      Environment = var.environment
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count                           = length(var.availability_zones)
  vpc_id                         = aws_vpc.main.id
  cidr_block                     = var.public_subnet_cidrs[count.index]
  availability_zone              = var.availability_zones[count.index]
  map_public_ip_on_launch       = true
  assign_ipv6_address_on_creation = true

  tags = merge(
    var.tags,
    {
      Name        = format("%s-public-subnet-%s", var.environment, var.availability_zones[count.index])
      Environment = var.environment
      Tier        = "public"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private" {
  count                           = length(var.availability_zones)
  vpc_id                         = aws_vpc.main.id
  cidr_block                     = var.private_subnet_cidrs[count.index]
  availability_zone              = var.availability_zones[count.index]
  map_public_ip_on_launch       = false
  assign_ipv6_address_on_creation = true

  tags = merge(
    var.tags,
    {
      Name        = format("%s-private-subnet-%s", var.environment, var.availability_zones[count.index])
      Environment = var.environment
      Tier        = "private"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name        = format("%s-igw", var.environment)
      Environment = var.environment
    }
  )
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    var.tags,
    {
      Name        = format("%s-nat-%s", var.environment, var.availability_zones[count.index])
      Environment = var.environment
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  vpc   = true

  tags = merge(
    var.tags,
    {
      Name        = format("%s-eip-%s", var.environment, var.availability_zones[count.index])
      Environment = var.environment
    }
  )
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    var.tags,
    {
      Name        = format("%s-public-rt", var.environment)
      Environment = var.environment
      Tier        = "public"
    }
  )
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.enable_nat_gateway ? aws_nat_gateway.main[var.single_nat_gateway ? 0 : count.index].id : null
  }

  tags = merge(
    var.tags,
    {
      Name        = format("%s-private-rt-%s", var.environment, var.availability_zones[count.index])
      Environment = var.environment
      Tier        = "private"
    }
  )
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.environment}-alb-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name        = format("%s-alb-sg", var.environment)
      Environment = var.environment
      Tier        = "public"
    }
  )
}

resource "aws_security_group" "app" {
  name_prefix = "${var.environment}-app-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name        = format("%s-app-sg", var.environment)
      Environment = var.environment
      Tier        = "private"
    }
  )
}

resource "aws_security_group" "db" {
  name_prefix = "${var.environment}-db-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(
    var.tags,
    {
      Name        = format("%s-db-sg", var.environment)
      Environment = var.environment
      Tier        = "private"
    }
  )
}

# VPC Flow Logs
resource "aws_flow_log" "main" {
  count                = var.enable_flow_logs ? 1 : 0
  iam_role_arn        = aws_iam_role.flow_log[0].arn
  log_destination     = aws_cloudwatch_log_group.flow_log[0].arn
  traffic_type        = "ALL"
  vpc_id              = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name        = format("%s-flow-logs", var.environment)
      Environment = var.environment
    }
  )
}

# VPC Endpoints for secure AWS service access
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"

  tags = merge(
    var.tags,
    {
      Name        = format("%s-s3-endpoint", var.environment)
      Environment = var.environment
    }
  )
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.dynamodb"

  tags = merge(
    var.tags,
    {
      Name        = format("%s-dynamodb-endpoint", var.environment)
      Environment = var.environment
    }
  )
}

# Data source for current AWS region
data "aws_region" "current" {}