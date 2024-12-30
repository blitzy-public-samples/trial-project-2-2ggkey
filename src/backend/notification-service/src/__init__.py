"""
Notification service package initialization module.
Configures enhanced logging with correlation IDs, log rotation, and multi-handler support.

Version: 1.0.0
"""

import logging
import logging.handlers
from typing import Dict, Any

from .app import app  # FastAPI v0.95.0+
from .config import Config  # Internal configuration module

# Initialize root logger
logger = logging.getLogger(__name__)

# Define comprehensive logging configuration
logging_config: Dict[str, Any] = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            'format': '%(asctime)s - %(correlation_id)s - %(name)s - %(levelname)s - %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
        'simple': {
            'format': '%(levelname)s - %(message)s'
        }
    },
    'filters': {
        'correlation_id': {
            '()': 'app.middleware.CorrelationIdFilter'
        }
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'filters': ['correlation_id'],
            'level': Config.LOG_LEVEL
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': Config.LOG_FILE_PATH,
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'default',
            'filters': ['correlation_id'],
            'level': Config.LOG_LEVEL
        }
    },
    'loggers': {
        'notification_service': {
            'handlers': ['console', 'file'],
            'level': Config.LOG_LEVEL,
            'propagate': False
        },
        'notification_service.api': {
            'handlers': ['console', 'file'],
            'level': Config.LOG_LEVEL,
            'propagate': False
        }
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': Config.LOG_LEVEL
    }
}

def configure_logging() -> None:
    """
    Configures the logging system with enhanced features including log rotation,
    correlation IDs, and multiple handlers.
    
    Features:
    - Log rotation with size-based triggers
    - Correlation ID tracking across requests
    - Console and file logging
    - Component-specific log levels
    - Comprehensive formatting
    """
    try:
        # Configure logging with dictionary config
        logging.config.dictConfig(logging_config)
        
        # Validate logging configuration
        logger.info("Logging configuration initialized successfully")
        
        # Log initial configuration state
        logger.debug(
            "Logging configured with level: %s, handlers: console, file",
            Config.LOG_LEVEL
        )
        
    except Exception as e:
        # Fallback to basic logging if configuration fails
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        logger.error("Failed to configure logging: %s", str(e))
        raise

# Configure logging on module import
configure_logging()

# Export FastAPI application instance and configuration
__all__ = ['app', 'Config']