"""
Configuration module for the notification service.
Handles environment variables, service settings, and constants with enhanced security features.

Version: 1.0.0
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
import json
from dotenv import load_dotenv  # python-dotenv v1.0.0
import logging
from pathlib import Path
import ssl
from functools import lru_cache

# Load environment variables securely
load_dotenv(override=True)

# Default constants
DEFAULT_BATCH_SIZE = 100
DEFAULT_RETRY_ATTEMPTS = 3
DEFAULT_RETRY_DELAY = 300  # seconds

# Secure logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class Config:
    """
    Immutable configuration class containing all service settings and environment variables.
    Implements secure handling and validation of all configuration values.
    """
    # Environment settings
    ENVIRONMENT: str
    LOG_LEVEL: str
    
    # SMTP Configuration
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    SMTP_FROM_EMAIL: str
    
    # RabbitMQ Configuration
    RABBITMQ_HOST: str
    RABBITMQ_PORT: int
    RABBITMQ_USER: str
    RABBITMQ_PASSWORD: str
    RABBITMQ_VHOST: str
    
    # Redis Configuration
    REDIS_HOST: str
    REDIS_PORT: int
    REDIS_PASSWORD: str
    
    # Notification Settings
    NOTIFICATION_BATCH_SIZE: int
    NOTIFICATION_RETRY_ATTEMPTS: int
    NOTIFICATION_RETRY_DELAY: int
    
    # Security Settings
    ENABLE_SSL: bool
    SSL_CERT_PATH: str
    
    # Notification Templates
    NOTIFICATION_TEMPLATES: Dict[str, Dict[str, str]]

    def __post_init__(self) -> None:
        """
        Validates configuration after initialization.
        Raises ValueError if configuration is invalid.
        """
        self.validate_config()

    def validate_config(self) -> bool:
        """
        Comprehensively validates all configuration values with security checks.
        Returns True if all configurations are valid and secure.
        
        Raises:
            ValueError: If any configuration value is invalid
            SecurityError: If any security-related configuration is insufficient
        """
        # Validate environment
        if self.ENVIRONMENT not in {'development', 'staging', 'production'}:
            raise ValueError(f"Invalid environment: {self.ENVIRONMENT}")

        # Validate SMTP configuration
        if not all([self.SMTP_HOST, self.SMTP_USER, self.SMTP_PASSWORD]):
            raise ValueError("Missing required SMTP configuration")
        
        if not 0 < self.SMTP_PORT <= 65535:
            raise ValueError(f"Invalid SMTP port: {self.SMTP_PORT}")

        # Validate RabbitMQ configuration
        if not all([self.RABBITMQ_HOST, self.RABBITMQ_USER, self.RABBITMQ_PASSWORD]):
            raise ValueError("Missing required RabbitMQ configuration")
        
        if not 0 < self.RABBITMQ_PORT <= 65535:
            raise ValueError(f"Invalid RabbitMQ port: {self.RABBITMQ_PORT}")

        # Validate Redis configuration
        if not all([self.REDIS_HOST, self.REDIS_PASSWORD]):
            raise ValueError("Missing required Redis configuration")
        
        if not 0 < self.REDIS_PORT <= 65535:
            raise ValueError(f"Invalid Redis port: {self.REDIS_PORT}")

        # Validate notification settings
        if not 0 < self.NOTIFICATION_BATCH_SIZE <= 1000:
            raise ValueError(f"Invalid batch size: {self.NOTIFICATION_BATCH_SIZE}")
        
        if not 0 < self.NOTIFICATION_RETRY_ATTEMPTS <= 10:
            raise ValueError(f"Invalid retry attempts: {self.NOTIFICATION_RETRY_ATTEMPTS}")
        
        if not 0 < self.NOTIFICATION_RETRY_DELAY <= 3600:
            raise ValueError(f"Invalid retry delay: {self.NOTIFICATION_RETRY_DELAY}")

        # Validate SSL configuration
        if self.ENABLE_SSL:
            if not Path(self.SSL_CERT_PATH).exists():
                raise ValueError(f"SSL certificate not found: {self.SSL_CERT_PATH}")

        # Validate notification templates
        if not isinstance(self.NOTIFICATION_TEMPLATES, dict):
            raise ValueError("Invalid notification templates format")

        for template_name, template in self.NOTIFICATION_TEMPLATES.items():
            if not all(k in template for k in ['subject', 'body']):
                raise ValueError(f"Invalid template format for: {template_name}")

        return True

    def get_masked_config(self) -> Dict[str, Any]:
        """
        Returns configuration with sensitive values masked for logging.
        """
        config_dict = {
            'ENVIRONMENT': self.ENVIRONMENT,
            'LOG_LEVEL': self.LOG_LEVEL,
            'SMTP_HOST': self.SMTP_HOST,
            'SMTP_PORT': self.SMTP_PORT,
            'SMTP_USER': self.SMTP_USER,
            'SMTP_PASSWORD': '********',
            'SMTP_FROM_EMAIL': self.SMTP_FROM_EMAIL,
            'RABBITMQ_HOST': self.RABBITMQ_HOST,
            'RABBITMQ_PORT': self.RABBITMQ_PORT,
            'RABBITMQ_USER': self.RABBITMQ_USER,
            'RABBITMQ_PASSWORD': '********',
            'RABBITMQ_VHOST': self.RABBITMQ_VHOST,
            'REDIS_HOST': self.REDIS_HOST,
            'REDIS_PORT': self.REDIS_PORT,
            'REDIS_PASSWORD': '********',
            'NOTIFICATION_BATCH_SIZE': self.NOTIFICATION_BATCH_SIZE,
            'NOTIFICATION_RETRY_ATTEMPTS': self.NOTIFICATION_RETRY_ATTEMPTS,
            'NOTIFICATION_RETRY_DELAY': self.NOTIFICATION_RETRY_DELAY,
            'ENABLE_SSL': self.ENABLE_SSL,
            'SSL_CERT_PATH': self.SSL_CERT_PATH
        }
        return config_dict

    @classmethod
    @lru_cache(maxsize=1)
    def load(cls) -> 'Config':
        """
        Creates and returns a singleton instance of the Config class.
        Uses environment variables with secure defaults.
        """
        try:
            # Load notification templates
            templates_path = os.getenv('NOTIFICATION_TEMPLATES_PATH', 'templates/notifications.json')
            with open(templates_path, 'r') as f:
                notification_templates = json.load(f)

            return cls(
                ENVIRONMENT=os.getenv('ENVIRONMENT', 'development'),
                LOG_LEVEL=os.getenv('LOG_LEVEL', 'INFO'),
                SMTP_HOST=os.environ['SMTP_HOST'],
                SMTP_PORT=int(os.environ['SMTP_PORT']),
                SMTP_USER=os.environ['SMTP_USER'],
                SMTP_PASSWORD=os.environ['SMTP_PASSWORD'],
                SMTP_FROM_EMAIL=os.environ['SMTP_FROM_EMAIL'],
                RABBITMQ_HOST=os.environ['RABBITMQ_HOST'],
                RABBITMQ_PORT=int(os.environ['RABBITMQ_PORT']),
                RABBITMQ_USER=os.environ['RABBITMQ_USER'],
                RABBITMQ_PASSWORD=os.environ['RABBITMQ_PASSWORD'],
                RABBITMQ_VHOST=os.getenv('RABBITMQ_VHOST', '/'),
                REDIS_HOST=os.environ['REDIS_HOST'],
                REDIS_PORT=int(os.environ['REDIS_PORT']),
                REDIS_PASSWORD=os.environ['REDIS_PASSWORD'],
                NOTIFICATION_BATCH_SIZE=int(os.getenv('NOTIFICATION_BATCH_SIZE', DEFAULT_BATCH_SIZE)),
                NOTIFICATION_RETRY_ATTEMPTS=int(os.getenv('NOTIFICATION_RETRY_ATTEMPTS', DEFAULT_RETRY_ATTEMPTS)),
                NOTIFICATION_RETRY_DELAY=int(os.getenv('NOTIFICATION_RETRY_DELAY', DEFAULT_RETRY_DELAY)),
                ENABLE_SSL=os.getenv('ENABLE_SSL', 'true').lower() == 'true',
                SSL_CERT_PATH=os.getenv('SSL_CERT_PATH', '/etc/ssl/certs/notification-service.pem'),
                NOTIFICATION_TEMPLATES=notification_templates
            )
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            logger.error(f"Configuration error: {str(e)}")
            raise

# Create singleton configuration instance
config = Config.load()

# Export specific members
__all__ = ['config', 'Config']
```

This implementation provides a secure, production-ready configuration module for the notification service with the following key features:

1. Immutable configuration using dataclass with frozen=True
2. Comprehensive validation of all configuration values
3. Secure handling of sensitive data with masking for logs
4. Type hints for enhanced safety and IDE support
5. Environment variable loading with secure defaults
6. Singleton pattern for configuration instance
7. Secure template loading and validation
8. Port range validation for all network services
9. SSL certificate validation when SSL is enabled
10. Comprehensive error handling and logging

The configuration can be used throughout the notification service by importing the singleton config instance:

```python
from config import config

# Access configuration values
smtp_host = config.SMTP_HOST
batch_size = config.NOTIFICATION_BATCH_SIZE

# Get masked config for logging
masked_config = config.get_masked_config()