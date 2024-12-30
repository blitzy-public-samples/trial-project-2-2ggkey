package com.taskmanager.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.tags.Tag;

/**
 * Configuration class for Swagger/OpenAPI documentation of the Task Management Service.
 * Provides comprehensive API documentation with security schemes, detailed endpoint descriptions,
 * and complete metadata for API consumers.
 *
 * @version 1.0
 * @since 2024-01
 */
@Configuration
public class SwaggerConfig {

    // API Documentation Constants
    private static final String API_VERSION = "1.0";
    private static final String API_TITLE = "Task Management Service API";
    private static final String API_DESCRIPTION = """
        Enterprise-grade REST API for Task Management System providing comprehensive task and project management capabilities.
        Features include:
        - Task CRUD operations with rich metadata
        - Project organization and hierarchy management
        - Team collaboration and assignment workflows
        - File attachment handling
        - Real-time updates and notifications
        - Advanced search and filtering
        """;
    private static final String SECURITY_SCHEME_NAME = "JWT Authentication";

    /**
     * Configures detailed API information including version, description, contact details,
     * and licensing information.
     *
     * @return Info object containing comprehensive API metadata
     */
    @Bean
    public Info apiInfo() {
        return new Info()
            .title(API_TITLE)
            .version(API_VERSION)
            .description(API_DESCRIPTION)
            .contact(new Contact()
                .name("Task Management System Team")
                .email("api-support@taskmanager.com")
                .url("https://taskmanager.com/support"))
            .license(new License()
                .name("Enterprise License")
                .url("https://taskmanager.com/license"))
            .termsOfService("https://taskmanager.com/terms");
    }

    /**
     * Creates and configures the OpenAPI specification with security schemes,
     * server information, and comprehensive documentation details.
     *
     * @return OpenAPI object with complete API specification
     */
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(apiInfo())
            .components(new Components()
                .addSecuritySchemes(SECURITY_SCHEME_NAME, 
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Provide a valid JWT token for API authentication")))
            .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
            .addServersItem(new Server()
                .url("/api/v1")
                .description("Task Management Service API v1"))
            .addTagsItem(new Tag()
                .name("Tasks")
                .description("Task management operations"))
            .addTagsItem(new Tag()
                .name("Projects")
                .description("Project management operations"))
            .addTagsItem(new Tag()
                .name("Teams")
                .description("Team management operations"))
            .addTagsItem(new Tag()
                .name("Files")
                .description("File attachment operations"));
    }
}