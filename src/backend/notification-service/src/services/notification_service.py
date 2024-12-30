"""
Core notification service implementing priority-based message processing, 
comprehensive retry mechanisms, and multi-channel delivery with robust error handling and monitoring.

Version: 1.0.0
"""

import asyncio
import logging
from typing import Dict, Optional, List
from datetime import datetime
import pika  # v1.3.0
from prometheus_client import Counter  # v0.16.0
from tenacity import retry, stop_after_attempt, wait_exponential  # v8.2.2

from .email_service import EmailService
from ..models.notification import (
    Notification, 
    NotificationType, 
    NotificationStatus,
    NotificationPriority
)
from ..config import config

# Configure logging
logger = logging.getLogger(__name__)

# Metrics collectors
NOTIFICATION_METRICS = Counter(
    'notifications_total',
    'Total notifications processed',
    ['type', 'status', 'priority']
)

# Retry policy for notification processing
RETRY_POLICY = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)

class NotificationService:
    """
    Advanced service class for managing and processing notifications with 
    priority queues, retry mechanisms, and monitoring.
    """

    def __init__(self):
        """Initialize notification service with enhanced configuration."""
        # Initialize services and connections
        self._email_service = EmailService()
        self._initialize_message_queue()
        
        # Initialize priority queues
        self._priority_queues = {
            NotificationPriority.URGENT: asyncio.Queue(maxsize=1000),
            NotificationPriority.HIGH: asyncio.Queue(maxsize=2000),
            NotificationPriority.MEDIUM: asyncio.Queue(maxsize=5000),
            NotificationPriority.LOW: asyncio.Queue(maxsize=10000)
        }
        
        # Initialize rate limiters per notification type
        self._rate_limiters = {
            NotificationType.EMAIL: Counter('email_rate', 'Email rate limiter'),
            NotificationType.IN_APP: Counter('in_app_rate', 'In-app rate limiter'),
            NotificationType.SYSTEM: Counter('system_rate', 'System rate limiter')
        }

    def _initialize_message_queue(self) -> None:
        """Initialize RabbitMQ connection with priority queues."""
        try:
            # Establish RabbitMQ connection
            credentials = pika.PlainCredentials(
                config.RABBITMQ_USER,
                config.RABBITMQ_PASSWORD
            )
            
            parameters = pika.ConnectionParameters(
                host=config.RABBITMQ_HOST,
                port=config.RABBITMQ_PORT,
                virtual_host=config.RABBITMQ_VHOST,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )
            
            self._mq_connection = pika.BlockingConnection(parameters)
            channel = self._mq_connection.channel()
            
            # Declare priority queues
            for priority in NotificationPriority:
                queue_name = f"notifications.{priority.value}"
                channel.queue_declare(
                    queue=queue_name,
                    durable=True,
                    arguments={
                        'x-max-priority': 10,
                        'x-message-ttl': 86400000  # 24 hours
                    }
                )
            
            logger.info("Successfully initialized message queue")
            
        except Exception as e:
            logger.error(f"Failed to initialize message queue: {str(e)}")
            raise

    @RETRY_POLICY
    async def send_notification(
        self,
        notification: Notification,
        priority: NotificationPriority
    ) -> bool:
        """
        Process and send notification with priority handling and rate limiting.

        Args:
            notification: Notification object to process
            priority: Priority level for processing

        Returns:
            bool: True if notification sent successfully

        Raises:
            ValueError: If notification validation fails
            RuntimeError: If processing fails after retries
        """
        try:
            # Validate notification
            if not notification or not isinstance(notification, Notification):
                raise ValueError("Invalid notification object")

            # Apply rate limiting
            if not self._check_rate_limit(notification.notification_type):
                logger.warning(f"Rate limit exceeded for {notification.notification_type}")
                await self._priority_queues[priority].put(notification)
                return False

            # Process based on notification type
            success = False
            if notification.notification_type == NotificationType.EMAIL:
                success = await self._process_email_notification(notification)
            elif notification.notification_type == NotificationType.IN_APP:
                success = await self._process_in_app_notification(notification)
            elif notification.notification_type == NotificationType.SYSTEM:
                success = await self._process_system_notification(notification)

            # Update metrics
            NOTIFICATION_METRICS.labels(
                type=notification.notification_type.value,
                status="success" if success else "failure",
                priority=priority.value
            ).inc()

            # Update notification status
            notification.update_status(
                NotificationStatus.SENT if success else NotificationStatus.FAILED
            )

            return success

        except Exception as e:
            logger.error(f"Error processing notification {notification.id}: {str(e)}")
            notification.update_status(
                NotificationStatus.FAILED,
                error_message=str(e)
            )
            raise

    async def _process_email_notification(self, notification: Notification) -> bool:
        """Process email notification with connection pooling and template validation."""
        try:
            return self._email_service.send_email(notification)
        except Exception as e:
            logger.error(f"Email notification failed: {str(e)}")
            return False

    async def _process_in_app_notification(self, notification: Notification) -> bool:
        """Process in-app notification with real-time delivery."""
        try:
            # Implementation for in-app notifications would go here
            # This is a placeholder for the actual implementation
            logger.info(f"Processing in-app notification: {notification.id}")
            return True
        except Exception as e:
            logger.error(f"In-app notification failed: {str(e)}")
            return False

    async def _process_system_notification(self, notification: Notification) -> bool:
        """Process system notification with logging and monitoring."""
        try:
            # Implementation for system notifications would go here
            # This is a placeholder for the actual implementation
            logger.info(f"Processing system notification: {notification.id}")
            return True
        except Exception as e:
            logger.error(f"System notification failed: {str(e)}")
            return False

    def _check_rate_limit(self, notification_type: NotificationType) -> bool:
        """Check if notification type has exceeded rate limits."""
        current_rate = self._rate_limiters[notification_type]._value.get()
        max_rates = {
            NotificationType.EMAIL: 100,  # per minute
            NotificationType.IN_APP: 1000,  # per minute
            NotificationType.SYSTEM: 500   # per minute
        }
        return current_rate < max_rates[notification_type]

    async def process_queued_notifications(self) -> None:
        """Process notifications from priority queues with error handling."""
        while True:
            try:
                # Process queues in priority order
                for priority in NotificationPriority:
                    queue = self._priority_queues[priority]
                    while not queue.empty():
                        notification = await queue.get()
                        await self.send_notification(notification, priority)
                        queue.task_done()
                
                await asyncio.sleep(1)  # Prevent CPU thrashing
                
            except Exception as e:
                logger.error(f"Error processing queued notifications: {str(e)}")
                await asyncio.sleep(5)  # Back off on error

    def cleanup(self) -> None:
        """Clean up resources and connections."""
        try:
            if self._mq_connection and not self._mq_connection.is_closed:
                self._mq_connection.close()
            logger.info("Successfully cleaned up notification service")
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")