"""
Template management utility module for the notification service.
Provides secure template loading, caching, and rendering with comprehensive validation.

Version: 1.0.0
"""

import logging
from pathlib import Path
from typing import Dict, Any, Optional, Set, Tuple
from jinja2 import Environment, FileSystemLoader, Template, SecurityError, sandbox  # v3.1.2
from ..models.notification import NotificationType

# Configure logging
logger = logging.getLogger(__name__)

# Constants
TEMPLATE_DIR = Path(__file__).parent.parent / 'templates'
TEMPLATE_CACHE_TTL = 3600  # 1 hour cache TTL
MAX_TEMPLATE_SIZE = 1048576  # 1MB maximum template size

class TemplateManager:
    """
    Manages notification templates with secure rendering, caching, and validation.
    Implements comprehensive security measures and performance optimizations.
    """

    def __init__(self, cache_ttl: Optional[int] = None, auto_reload: bool = False):
        """
        Initialize the template manager with secure defaults.

        Args:
            cache_ttl: Optional cache time-to-live in seconds
            auto_reload: Whether to auto-reload templates in development
        """
        # Configure secure Jinja2 environment
        self._jinja_env = sandbox.SandboxedEnvironment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=True,
            auto_reload=auto_reload,
            trim_blocks=True,
            lstrip_blocks=True,
            # Restrict potentially dangerous operations
            finalize=lambda x: x if isinstance(x, (str, int, float, bool)) else str(x)
        )

        # Add custom security filters
        self._jinja_env.filters.update({
            'safe_json': self._safe_json_filter,
            'html_escape': self._html_escape_filter
        })

        # Initialize template cache
        self._template_cache: Dict[str, Dict[str, Template]] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._template_versions: Dict[str, str] = {}
        self._cache_ttl = cache_ttl or TEMPLATE_CACHE_TTL

    def load_template(self, template_name: str, 
                     notification_type: NotificationType,
                     bypass_cache: bool = False) -> Template:
        """
        Securely load and cache a template with comprehensive validation.

        Args:
            template_name: Name of the template to load
            notification_type: Type of notification for template selection
            bypass_cache: Whether to bypass the template cache

        Returns:
            Validated and cached template object

        Raises:
            ValueError: If template validation fails
            SecurityError: If template contains security violations
            FileNotFoundError: If template file doesn't exist
        """
        cache_key = f"{notification_type.value}:{template_name}"

        # Check cache if enabled
        if not bypass_cache and cache_key in self._template_cache:
            if (self._cache_timestamps.get(cache_key, 0) + self._cache_ttl) > time.time():
                logger.debug(f"Cache hit for template: {cache_key}")
                return self._template_cache[cache_key]

        # Construct secure template path
        template_path = TEMPLATE_DIR / notification_type.value / f"{template_name}.html"
        
        try:
            # Validate template file
            if not template_path.is_file():
                raise FileNotFoundError(f"Template not found: {template_path}")
            
            if template_path.stat().st_size > MAX_TEMPLATE_SIZE:
                raise ValueError(f"Template exceeds size limit: {template_path}")

            # Load and validate template
            template_content = template_path.read_text()
            validation_result, error = self.validate_template(template_content)
            
            if not validation_result:
                raise ValueError(f"Template validation failed: {error}")

            # Compile template with security sandbox
            template = self._jinja_env.from_string(template_content)
            
            # Update cache
            self._template_cache[cache_key] = template
            self._cache_timestamps[cache_key] = time.time()
            self._template_versions[cache_key] = self._compute_template_hash(template_content)

            logger.info(f"Successfully loaded template: {cache_key}")
            return template

        except Exception as e:
            logger.error(f"Error loading template {template_name}: {str(e)}")
            raise

    def render_template(self, template_name: str,
                       notification_type: NotificationType,
                       context: Dict[str, Any],
                       escape_html: bool = True) -> str:
        """
        Securely render a template with context validation.

        Args:
            template_name: Name of the template to render
            notification_type: Type of notification
            context: Template context data
            escape_html: Whether to escape HTML in output

        Returns:
            Rendered template content

        Raises:
            ValueError: If context validation fails
            SecurityError: If rendering violates security constraints
        """
        try:
            # Validate context data
            self._validate_context(context)
            
            # Load template
            template = self.load_template(template_name, notification_type)
            
            # Create secure sandbox for rendering
            sandbox_env = sandbox.ImmutableSandboxedEnvironment()
            
            # Render template with security measures
            rendered_content = template.render(
                **context,
                escape_html=escape_html,
                notification_type=notification_type.value
            )

            # Apply additional security measures
            if escape_html:
                rendered_content = self._html_escape_filter(rendered_content)

            logger.info(f"Successfully rendered template: {template_name}")
            return rendered_content

        except Exception as e:
            logger.error(f"Error rendering template {template_name}: {str(e)}")
            raise

    def reload_templates(self) -> Dict[str, bool]:
        """
        Safely reload all templates and update cache.

        Returns:
            Dictionary of template names and their reload status
        """
        reload_status = {}
        
        try:
            # Clear existing cache
            self._template_cache.clear()
            self._cache_timestamps.clear()
            
            # Scan template directory
            for notification_type in NotificationType:
                type_dir = TEMPLATE_DIR / notification_type.value
                if not type_dir.is_dir():
                    continue
                
                for template_file in type_dir.glob("*.html"):
                    template_name = template_file.stem
                    try:
                        self.load_template(
                            template_name,
                            notification_type,
                            bypass_cache=True
                        )
                        reload_status[template_name] = True
                    except Exception as e:
                        logger.error(f"Failed to reload template {template_name}: {str(e)}")
                        reload_status[template_name] = False

            logger.info("Template reload completed")
            return reload_status

        except Exception as e:
            logger.error(f"Error during template reload: {str(e)}")
            raise

    def validate_template(self, template_content: str,
                         required_variables: Optional[Set[str]] = None) -> Tuple[bool, Optional[str]]:
        """
        Perform comprehensive template validation.

        Args:
            template_content: Template content to validate
            required_variables: Set of required template variables

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Check template size
            if len(template_content) > MAX_TEMPLATE_SIZE:
                return False, "Template exceeds maximum size limit"

            # Validate template syntax
            self._jinja_env.parse(template_content)
            
            # Check for required variables
            if required_variables:
                ast = self._jinja_env.parse(template_content)
                template_variables = set(self._extract_variables(ast))
                missing_vars = required_variables - template_variables
                if missing_vars:
                    return False, f"Missing required variables: {missing_vars}"

            # Validate template security
            sandbox_env = sandbox.ImmutableSandboxedEnvironment()
            sandbox_env.parse(template_content)

            return True, None

        except Exception as e:
            return False, str(e)

    def _validate_context(self, context: Dict[str, Any]) -> None:
        """
        Validate template context data for security.
        """
        if not isinstance(context, dict):
            raise ValueError("Context must be a dictionary")

        # Recursively validate context values
        def validate_value(value: Any) -> None:
            if isinstance(value, dict):
                for k, v in value.items():
                    if not isinstance(k, str):
                        raise ValueError("Dictionary keys must be strings")
                    validate_value(v)
            elif isinstance(value, (list, tuple)):
                for item in value:
                    validate_value(item)
            elif not isinstance(value, (str, int, float, bool, type(None))):
                raise ValueError(f"Invalid context value type: {type(value)}")

        validate_value(context)

    @staticmethod
    def _safe_json_filter(value: Any) -> str:
        """
        Safely convert value to JSON string.
        """
        import json
        return json.dumps(value, default=str)

    @staticmethod
    def _html_escape_filter(value: str) -> str:
        """
        Safely escape HTML content.
        """
        import html
        return html.escape(str(value))

    @staticmethod
    def _compute_template_hash(content: str) -> str:
        """
        Compute secure hash of template content.
        """
        import hashlib
        return hashlib.sha256(content.encode()).hexdigest()

    @staticmethod
    def _extract_variables(ast) -> Set[str]:
        """
        Extract variables from template AST.
        """
        variables = set()
        
        def visit_node(node):
            if hasattr(node, 'name'):
                variables.add(node.name)
            if hasattr(node, 'nodes'):
                for child in node.nodes:
                    visit_node(child)

        visit_node(ast)
        return variables