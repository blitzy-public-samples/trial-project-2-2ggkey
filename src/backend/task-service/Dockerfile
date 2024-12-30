# Stage 1: Build stage
FROM maven:3.9.3-eclipse-temurin-17-alpine AS builder

# Set working directory
WORKDIR /app

# Copy pom.xml for dependency resolution
COPY pom.xml .

# Download dependencies and cache them
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build application with optimizations
RUN mvn clean package -DskipTests \
    -Dmaven.compiler.source=17 \
    -Dmaven.compiler.target=17 \
    -Dmaven.test.skip=true \
    -Dspring-boot.repackage.layout=LAYERED_JAR

# Stage 2: Production stage
FROM eclipse-temurin:17-jre-alpine

# Add metadata labels
LABEL maintainer="TaskManager Team" \
      version="1.0.0" \
      description="Task Management Service - Production Image" \
      org.opencontainers.image.source="https://github.com/taskmanager/task-service"

# Create non-root user for security
RUN addgroup -S taskapp && \
    adduser -S -G taskapp taskuser && \
    mkdir -p /app /logs /tmp && \
    chown -R taskuser:taskapp /app /logs /tmp

# Set working directory
WORKDIR /app

# Copy JAR from builder stage
COPY --from=builder --chown=taskuser:taskapp /app/target/*.jar app.jar

# Install necessary tools for health check
RUN apk add --no-cache curl

# Set environment variables
ENV JAVA_OPTS="-Xms512m -Xmx1024m \
    -XX:+UseG1GC \
    -XX:+HeapDumpOnOutOfMemoryError \
    -XX:HeapDumpPath=/logs \
    -XX:+UseContainerSupport \
    -XX:MaxRAMPercentage=75.0 \
    -Djava.security.egd=file:/dev/./urandom \
    -Dspring.profiles.active=prod \
    -Duser.timezone=UTC"

# Switch to non-root user
USER taskuser

# Expose ports
EXPOSE 8082 8081

# Set volume mount points
VOLUME ["/logs", "/tmp"]

# Health check configuration
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --retries=3 \
            --start-period=40s \
            CMD curl -f http://localhost:8082/actuator/health || exit 1

# Set security options
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS \
    -Djava.security.properties=/app/security.properties \
    -Dcom.sun.management.jmxremote=true \
    -Dcom.sun.management.jmxremote.ssl=false \
    -Dcom.sun.management.jmxremote.authenticate=false \
    -Dcom.sun.management.jmxremote.port=8081 \
    -Dcom.sun.management.jmxremote.rmi.port=8081 \
    -Djava.rmi.server.hostname=localhost \
    org.springframework.boot.loader.JarLauncher"]

# Security hardening
RUN chmod 400 app.jar && \
    touch security.properties && \
    echo "networkaddress.cache.ttl=60" >> security.properties && \
    echo "networkaddress.cache.negative.ttl=10" >> security.properties

# Set resource limits (to be enforced by container runtime)
# These should be adjusted based on actual requirements
# Example: docker run --memory="2g" --cpus="2"

# Additional security configurations
# These should be applied when running the container:
# --security-opt=no-new-privileges:true
# --cap-drop=ALL
# --cap-add=NET_BIND_SERVICE
# --read-only
# --tmpfs /tmp
# --health-start-period=40s