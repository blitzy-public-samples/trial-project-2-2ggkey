"""
Comprehensive test suite for the notification service covering all aspects of notification handling.
Tests notification creation, processing, delivery, error handling, security validation, and monitoring.

Version: 1.0.0
"""

import pytest  # v7.0.0
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timedelta
from typing import Dict, Any

from ..src.services.notification_service import NotificationService
from ..src.models.notification import (
    Notification,
    NotificationType,
    NotificationStatus,
    NotificationPriority
)

# Test constants
TEST_EMAIL_TEMPLATE = "test_email_template"
TEST_RECIPIENTS = ["test@example.com"]
TEST_SECURITY_CONTEXT = {
    "content_security": True,
    "rate_limit_group": "test",
    "validation_rules": ["xss", "injection"]
}

@pytest.fixture
async def notification_service():
    """Fixture providing configured notification service instance with mocks."""
    service = NotificationService()
    service._email_service = AsyncMock()
    service._websocket_service = AsyncMock()
    service._metrics_collector = Mock()
    return service

@pytest.fixture
def test_notification():
    """Fixture providing a test notification instance."""
    return Notification(
        template_name=TEST_EMAIL_TEMPLATE,
        notification_type=NotificationType.EMAIL,
        content={
            "subject": "Test Notification",
            "body": "Test message content",
            "security_context": TEST_SECURITY_CONTEXT
        },
        recipients=TEST_RECIPIENTS,
        priority=NotificationPriority.HIGH
    )

class TestNotificationService:
    """
    Comprehensive test suite for NotificationService covering all functionality.
    """

    @pytest.mark.asyncio
    async def test_send_email_notification_success(self, notification_service, test_notification):
        """Test successful email notification sending with security validation."""
        # Configure mocks
        notification_service._email_service.send_email.return_value = True
        
        # Send notification
        success = await notification_service.send_notification(
            test_notification,
            NotificationPriority.HIGH
        )

        # Verify success
        assert success is True
        assert test_notification.status == NotificationStatus.SENT
        notification_service._email_service.send_email.assert_called_once_with(test_notification)
        notification_service._metrics_collector.inc.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_email_notification_failure(self, notification_service, test_notification):
        """Test email notification failure handling and retry logic."""
        # Configure mock to fail
        notification_service._email_service.send_email.return_value = False
        
        # Send notification
        success = await notification_service.send_notification(
            test_notification,
            NotificationPriority.HIGH
        )

        # Verify failure handling
        assert success is False
        assert test_notification.status == NotificationStatus.FAILED
        assert len(test_notification.error_messages) == 1
        assert test_notification.retry_count == 1

    @pytest.mark.asyncio
    async def test_rate_limiting(self, notification_service):
        """Test rate limit enforcement for notifications."""
        # Create batch of test notifications
        notifications = [
            create_test_notification(
                NotificationType.EMAIL,
                NotificationPriority.HIGH,
                {"subject": f"Test {i}"},
                TEST_SECURITY_CONTEXT
            ) for i in range(150)  # Exceed rate limit
        ]

        # Send notifications rapidly
        results = await asyncio.gather(*[
            notification_service.send_notification(n, NotificationPriority.HIGH)
            for n in notifications
        ])

        # Verify rate limiting
        assert results.count(False) > 0  # Some should be rate limited
        assert notification_service._rate_limiters[NotificationType.EMAIL]._value.get() > 0

    @pytest.mark.asyncio
    async def test_priority_queue_processing(self, notification_service, test_notification):
        """Test priority-based queue processing."""
        # Add notifications with different priorities
        await notification_service._priority_queues[NotificationPriority.HIGH].put(test_notification)
        await notification_service._priority_queues[NotificationPriority.LOW].put(
            create_test_notification(
                NotificationType.EMAIL,
                NotificationPriority.LOW,
                {"subject": "Low Priority"},
                TEST_SECURITY_CONTEXT
            )
        )

        # Process queue
        await notification_service.process_queued_notifications()

        # Verify high priority processed first
        assert test_notification.status == NotificationStatus.SENT
        assert notification_service._priority_queues[NotificationPriority.HIGH].empty()

    @pytest.mark.asyncio
    async def test_notification_retry_mechanism(self, notification_service, test_notification):
        """Test notification retry mechanism with exponential backoff."""
        # Configure mock to fail initially then succeed
        notification_service._email_service.send_email.side_effect = [False, False, True]
        
        # Attempt notification with retries
        for _ in range(3):
            if test_notification.can_retry():
                await notification_service.send_notification(
                    test_notification,
                    NotificationPriority.HIGH
                )
                await asyncio.sleep(0.1)  # Simulate backoff

        # Verify retry behavior
        assert test_notification.status == NotificationStatus.SENT
        assert test_notification.retry_count == 2
        assert len(test_notification.error_messages) == 2

    @pytest.mark.asyncio
    async def test_security_validation(self, notification_service, test_notification):
        """Test security validation for notification content."""
        # Add malicious content
        test_notification.content["body"] = "<script>alert('xss')</script>"
        
        # Attempt to send
        with pytest.raises(ValueError, match="Security validation failed"):
            await notification_service.send_notification(
                test_notification,
                NotificationPriority.HIGH
            )

    @pytest.mark.asyncio
    async def test_metrics_collection(self, notification_service, test_notification):
        """Test metrics collection during notification processing."""
        # Send notification
        await notification_service.send_notification(
            test_notification,
            NotificationPriority.HIGH
        )

        # Verify metrics
        notification_service._metrics_collector.inc.assert_called_with(
            labels={
                'type': 'email',
                'status': 'success',
                'priority': 'high'
            }
        )

def create_test_notification(
    notification_type: NotificationType,
    priority: NotificationPriority,
    content: Dict[str, Any],
    security_context: Dict[str, Any]
) -> Notification:
    """Create a test notification with security context."""
    return Notification(
        template_name=TEST_EMAIL_TEMPLATE,
        notification_type=notification_type,
        content={**content, "security_context": security_context},
        recipients=TEST_RECIPIENTS,
        priority=priority,
        metadata={
            "test_id": f"test_{datetime.utcnow().timestamp()}",
            "security_validation": True
        }
    )