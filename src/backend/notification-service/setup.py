import os
from setuptools import setup, find_packages

def read_requirements(req_type="prod"):
    """Read requirements from requirements.txt file.
    
    Args:
        req_type (str): Type of requirements to read ("prod" or "dev")
        
    Returns:
        list: List of requirements
    """
    requirements = []
    with open("requirements.txt") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            # Skip dev requirements if reading prod, and vice versa
            if req_type == "prod" and "# dev" in line:
                continue
            if req_type == "dev" and "# dev" not in line:
                continue
            # Remove dev marker and clean up
            requirements.append(line.replace("# dev", "").strip())
    return requirements

setup(
    name="notification-service",
    version="1.0.0",
    description="Task Management System Event-Driven Notification Service",
    author="Task Management System Team",
    author_email="team@taskmanagement.com",
    python_requires=">=3.11",
    
    # Package discovery
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    
    # Core dependencies
    install_requires=[
        "fastapi==0.115.6",          # Web framework for building APIs
        "uvicorn==0.24.0",           # ASGI server implementation
        "pydantic==2.4.2",           # Data validation using Python type annotations
        "redis==5.0.1",              # Redis client for caching
        "pika==1.3.2",               # RabbitMQ client for message queue
        "sendgrid==6.10.0",          # Email service client
        "python-jose==3.3.0",        # JWT token handling
        "sqlalchemy==2.0.23",        # SQL toolkit and ORM
        "alembic==1.12.1",           # Database migration tool
        "psycopg2-binary==2.9.9",    # PostgreSQL adapter
        "prometheus-client==0.18.0",  # Metrics collection
        "python-json-logger==2.0.7",  # JSON format logging
        "websockets==12.0",          # WebSocket server and client
        "aioredis==2.0.1",          # Async Redis client
        "tenacity==8.2.3",          # Retry library for resilience
        "httpx==0.25.1",            # Async HTTP client
    ],
    
    # Development dependencies
    extras_require={
        "dev": [
            "pytest==7.4.0",           # Testing framework
            "pytest-cov==4.1.0",       # Test coverage
            "pytest-asyncio==0.21.1",  # Async test support
            "black==23.7.0",           # Code formatter
            "flake8==6.1.0",           # Code linter
            "mypy==1.5.0",             # Static type checker
            "isort==5.12.0",           # Import sorter
            "pre-commit==3.5.0",       # Git hooks manager
            "docker==6.1.3",           # Docker SDK for testing
            "locust==2.17.0",          # Load testing
        ]
    },
    
    # Entry points for CLI commands
    entry_points={
        "console_scripts": [
            "notification-service=src.app:start_application",
            "notification-worker=src.worker:start_worker",
        ],
    },
    
    # Package metadata and classifiers
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
        "Framework :: FastAPI",
        "Environment :: Web Environment",
        "Typing :: Typed",
    ],
    
    # Additional package data
    include_package_data=True,
    zip_safe=False,
    
    # Project URLs
    project_urls={
        "Bug Tracker": "https://github.com/organization/task-management/issues",
        "Documentation": "https://docs.taskmanagement.com",
        "Source Code": "https://github.com/organization/task-management",
    },
)