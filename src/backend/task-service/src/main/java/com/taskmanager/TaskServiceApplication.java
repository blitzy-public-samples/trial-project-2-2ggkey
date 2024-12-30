package com.taskmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.cache.annotation.EnableCaching;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main application class for the Task Management Service.
 * Bootstraps the Spring Boot application with essential configurations for
 * security, scheduling, caching, and monitoring capabilities.
 *
 * @version 1.0
 * @since 2024-01
 */
@SpringBootApplication
@EnableScheduling
@EnableCaching
public class TaskServiceApplication {

    private static final Logger logger = LoggerFactory.getLogger(TaskServiceApplication.class);
    private static final String APP_NAME = "Task Management Service";
    private static final String[] REQUIRED_ENV_VARS = {
        "SPRING_DATASOURCE_URL",
        "SPRING_DATASOURCE_USERNAME",
        "SPRING_DATASOURCE_PASSWORD",
        "JWT_SECRET"
    };

    /**
     * Default constructor that initializes the application context.
     */
    public TaskServiceApplication() {
        logger.info("Initializing {} application", APP_NAME);
    }

    /**
     * Main entry point for the Task Management Service application.
     * Performs environment validation, initializes Spring context, and starts the service.
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            logger.info("Starting {} initialization", APP_NAME);
            
            // Validate environment configuration
            if (!validateEnvironment()) {
                logger.error("Environment validation failed. Terminating application startup.");
                System.exit(1);
            }

            // Configure application context
            var applicationContext = SpringApplication.run(TaskServiceApplication.class, args);
            
            // Log successful startup
            logger.info("{} successfully started", APP_NAME);
            
            // Register shutdown hook for graceful shutdown
            applicationContext.registerShutdownHook();
            
        } catch (Exception e) {
            logger.error("Failed to start {}: {}", APP_NAME, e.getMessage(), e);
            System.exit(1);
        }
    }

    /**
     * Validates required environment configuration for application startup.
     * Checks for presence of essential environment variables and configuration values.
     *
     * @return boolean indicating whether validation passed
     */
    private static boolean validateEnvironment() {
        logger.info("Validating environment configuration");
        
        // Check required environment variables
        for (String envVar : REQUIRED_ENV_VARS) {
            if (System.getenv(envVar) == null && System.getProperty(envVar) == null) {
                logger.error("Missing required environment variable: {}", envVar);
                return false;
            }
        }

        // Validate Java version
        String javaVersion = System.getProperty("java.version");
        if (!javaVersion.startsWith("17")) {
            logger.error("Unsupported Java version: {}. Required version: 17", javaVersion);
            return false;
        }

        // Validate memory settings
        long maxMemory = Runtime.getRuntime().maxMemory();
        if (maxMemory < 1024 * 1024 * 1024) { // 1GB minimum
            logger.warn("Available memory may be insufficient: {} bytes", maxMemory);
        }

        logger.info("Environment validation completed successfully");
        return true;
    }
}