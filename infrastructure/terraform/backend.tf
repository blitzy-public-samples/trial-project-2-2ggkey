# Task Management System - Terraform Backend Configuration
# Terraform >= 1.0.0
# AWS Provider >= 4.0.0

terraform {
  # Configure S3 backend for secure and highly available state management
  backend "s3" {
    # Primary state storage bucket with encryption and versioning
    bucket = "task-management-terraform-state"
    key    = "${var.environment}/terraform.tfstate"
    region = "us-east-1"
    
    # Enable server-side encryption for state files
    encrypt = true
    
    # Configure DynamoDB table for state locking
    dynamodb_table = "task-management-terraform-locks"
    
    # Enable versioning for state file history and recovery
    versioning = true
    
    # Restrict bucket access to private only
    acl = "private"
    
    # Configure server-side encryption with AES-256
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }
    
    # Configure cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication-role"
      rules {
        status = "Enabled"
        destination {
          bucket        = "arn:aws:s3:::task-management-terraform-state-replica"
          storage_class = "STANDARD"
        }
      }
    }
    
    # Additional backend settings for enhanced security and monitoring
    lifecycle_rule {
      enabled = true
      
      # Expire noncurrent versions after 30 days
      noncurrent_version_expiration {
        days = 30
      }
      
      # Clean up incomplete multipart uploads
      abort_incomplete_multipart_upload {
        days_after_initiation = 7
      }
    }
    
    # Enable access logging for audit purposes
    logging {
      target_bucket = "task-management-terraform-logs"
      target_prefix = "state-access-logs/"
    }
    
    # Block all public access
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
  }
}

# Local backend configuration for development and testing
# Uncomment and modify for local development use
# terraform {
#   backend "local" {
#     path = "terraform.tfstate"
#   }
# }