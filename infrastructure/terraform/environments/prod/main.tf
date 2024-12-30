# Task Management System - Production Environment Configuration
# Terraform >= 1.0.0
# AWS Provider >= 5.0.0

# Local variables for production environment
locals {
  environment = "prod"
  common_tags = {
    Environment         = "production"
    Project            = "TaskManagementSystem"
    ManagedBy          = "Terraform"
    SecurityLevel      = "high"
    ComplianceRequired = "true"
    DataClassification = "confidential"
    BackupFrequency    = "daily"
    MonitoringLevel    = "enhanced"
  }
}

# AWS Provider Configuration
provider "aws" {
  region = "us-west-2"
  default_tags {
    tags = local.common_tags
  }
}

# Kubernetes Provider Configuration
provider "kubernetes" {
  host                   = module.main.eks_cluster_endpoint
  cluster_ca_certificate = base64decode(module.main.eks_cluster_ca_cert)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.main.eks_cluster_name
    ]
  }
}

# Terraform State Backend Configuration
terraform {
  backend "s3" {
    bucket         = "taskmanager-terraform-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-prod"
  }
}

# Main Infrastructure Module
module "main" {
  source = "../../"

  # Environment Configuration
  environment = local.environment
  aws_region  = "us-west-2"

  # Network Configuration
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]

  # EKS Configuration
  eks_cluster_version = "1.27"
  node_instance_types = ["t3.xlarge", "m5.large"]

  # Database Configuration
  db_instance_class = "db.r6g.xlarge"
  redis_node_type   = "cache.r6g.large"

  # Monitoring Configuration
  monitoring_retention_days = 90
  enable_monitoring        = true

  # High Availability Settings
  enable_encryption   = true
  enable_backup      = true
  enable_multi_az    = true

  # Performance Settings
  enable_performance_insights = true

  providers = {
    aws        = aws
    kubernetes = kubernetes
  }
}

# Additional Production-specific Security Groups
resource "aws_security_group" "prod_enhanced" {
  name_prefix = "prod-enhanced-security"
  vpc_id      = module.main.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "prod-enhanced-security"
    }
  )
}

# Production Monitoring Alarms
resource "aws_cloudwatch_metric_alarm" "prod_cpu_high" {
  alarm_name          = "prod-cpu-utilization-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EKS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors EKS cluster CPU utilization"
  alarm_actions      = []

  dimensions = {
    ClusterName = module.main.eks_cluster_name
  }

  tags = local.common_tags
}

# Production Backup Policies
resource "aws_backup_plan" "prod_backup" {
  name = "prod-backup-plan"

  rule {
    rule_name         = "prod-backup-rule"
    target_vault_name = "prod-backup-vault"
    schedule          = "cron(0 5 ? * * *)"

    lifecycle {
      delete_after = 35
    }
  }

  tags = local.common_tags
}

# Production WAF Rules
resource "aws_wafv2_web_acl" "prod_waf" {
  name        = "prod-waf-acl"
  description = "Production WAF ACL with enhanced security rules"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "prod-waf-acl"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}