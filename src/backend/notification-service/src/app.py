"""
Main application entry point for the notification service.
Implements a FastAPI-based event-driven notification system with comprehensive middleware and monitoring.

Version: 1.0.0
"""

import logging
import asyncio
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_fastapi_instrumentator import Instrumentator  # v5.9.0
from fastapi_limiter import FastAPILimiter  # v0.1.5
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # v0.38b0
import redis.asyncio as redis
import uvicorn  # v0.21.0

from .config import Config
from .services.notification_service import NotificationService
from .models.notification import Notification, NotificationStatus, NotificationPriority

# Initialize FastAPI application
app = FastAPI(
    title="Notification Service",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize services
config = Config.load()
notification_service = NotificationService()
logger = logging.getLogger(__name__)

async def configure_logging() -> None:
    """Configure enhanced application logging with structured output."""
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

async def configure_middleware(app: FastAPI) -> None:
    """Configure comprehensive middleware stack for the application."""
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure based on environment
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    # Compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Security middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure based on environment
    )

    # Initialize rate limiter
    redis_instance = redis.from_url(
        f"redis://{config.REDIS_HOST}:{config.REDIS_PORT}",
        password=config.REDIS_PASSWORD,
        encoding="utf-8",
        decode_responses=True
    )
    await FastAPILimiter.init(redis_instance)

    # Initialize metrics
    Instrumentator().instrument(app).expose(app, include_in_schema=False)

    # Initialize tracing
    FastAPIInstrumentor.instrument_app(app)

@app.on_event("startup")
async def startup_handler() -> None:
    """Initialize application resources and connections."""
    try:
        # Configure logging
        await configure_logging()
        
        # Configure middleware
        await configure_middleware(app)
        
        # Initialize notification service
        await notification_service.initialize_queues()
        
        # Start background tasks
        asyncio.create_task(notification_service.process_queued_notifications())
        
        logger.info("Notification service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start notification service: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_handler() -> None:
    """Cleanup application resources gracefully."""
    try:
        await notification_service.cleanup_resources()
        logger.info("Notification service shutdown completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
        raise

@app.post("/api/v1/notifications", response_model=Dict[str, Any])
async def send_notification(notification: Notification) -> Dict[str, Any]:
    """
    Send a new notification through the service.
    
    Args:
        notification: Notification object containing all required details
        
    Returns:
        Dict containing notification status and ID
        
    Raises:
        HTTPException: If notification processing fails
    """
    try:
        success = await notification_service.send_notification(
            notification,
            notification.priority
        )
        
        return {
            "notification_id": str(notification.id),
            "status": notification.status.value,
            "success": success
        }
        
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send notification: {str(e)}"
        )

@app.get("/api/v1/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint for monitoring.
    
    Returns:
        Dict containing service status
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=config.ENVIRONMENT == "development",
        workers=4,
        log_level=config.LOG_LEVEL.lower()
    )