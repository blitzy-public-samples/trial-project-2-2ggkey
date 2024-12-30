// Package main provides the entry point for the file service application with
// comprehensive security, monitoring, and graceful shutdown capabilities.
package main

import (
    "context"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/prometheus/client_golang/prometheus" // v1.15.0
    "github.com/prometheus/client_golang/prometheus/promhttp" // v1.15.0
    "go.uber.org/zap" // v1.24.0
    "golang.org/x/crypto/acme/autocert" // latest

    "src/backend/file-service/internal/config"
    "src/backend/file-service/internal/handlers"
    "src/backend/file-service/internal/service"
    "src/backend/file-service/internal/storage"
    "src/backend/file-service/pkg/logger"
)

const (
    shutdownTimeout    = 30 * time.Second
    healthCheckPath    = "/health"
    metricsPath       = "/metrics"
    maxHeaderBytes    = 1 << 20 // 1MB
    readHeaderTimeout = 5 * time.Second
)

// Prometheus metrics
var (
    requestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "Duration of HTTP requests in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"handler", "method", "status"},
    )
    
    activeRequests = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "http_requests_active",
            Help: "Number of active HTTP requests",
        },
    )
)

func main() {
    // Initialize structured logging
    log, err := logger.InitLogger(&logger.LogConfig{
        Level:         "info",
        Development:   false,
        EnableConsole: true,
        Encoding:      "json",
    })
    if err != nil {
        fmt.Printf("Failed to initialize logger: %v\n", err)
        os.Exit(1)
    }
    defer log.Sync()

    // Load and validate configuration
    cfg, err := config.LoadConfig()
    if err != nil {
        log.Fatal("Failed to load configuration",
            zap.Error(err))
    }

    // Initialize metrics registry
    registry := prometheus.NewRegistry()
    registry.MustRegister(
        requestDuration,
        activeRequests,
        prometheus.NewGoCollector(),
        prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
    )

    // Initialize storage
    s3Storage, err := storage.NewS3Storage(cfg)
    if err != nil {
        log.Fatal("Failed to initialize storage",
            zap.Error(err))
    }

    // Initialize file service
    fileService, err := service.NewFileService(s3Storage, service.WorkerPoolConfig{
        MaxWorkers:  10,
        QueueSize:   100,
        BufferSize:  32 * 1024,
    })
    if err != nil {
        log.Fatal("Failed to initialize file service",
            zap.Error(err))
    }

    // Initialize HTTP handlers
    fileHandler := handlers.NewFileHandler(fileService, registry)

    // Configure and start HTTP server
    server := setupSecureServer(cfg, fileHandler, registry)

    // Start server in a goroutine
    go func() {
        log.Info("Starting server",
            zap.String("address", fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)))
        
        var err error
        if cfg.Server.TLSEnabled {
            // Configure automatic TLS certificate management
            certManager := autocert.Manager{
                Prompt:     autocert.AcceptTOS,
                Cache:      autocert.DirCache("certs"),
                HostPolicy: autocert.HostWhitelist(cfg.Server.Host),
            }
            server.TLSConfig = certManager.TLSConfig()
            err = server.ListenAndServeTLS("", "")
        } else {
            err = server.ListenAndServe()
        }

        if err != nil && err != http.ErrServerClosed {
            log.Fatal("Server failed",
                zap.Error(err))
        }
    }()

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Info("Shutting down server...")

    // Create shutdown context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
    defer cancel()

    // Attempt graceful shutdown
    if err := server.Shutdown(ctx); err != nil {
        log.Error("Server forced to shutdown",
            zap.Error(err))
    }

    log.Info("Server stopped")
}

// setupSecureServer configures the HTTP server with security features
func setupSecureServer(cfg *config.Config, handler *handlers.FileHandler, registry *prometheus.Registry) *http.Server {
    mux := http.NewServeMux()

    // Add security middleware
    secureMiddleware := func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Security headers
            w.Header().Set("X-Content-Type-Options", "nosniff")
            w.Header().Set("X-Frame-Options", "DENY")
            w.Header().Set("X-XSS-Protection", "1; mode=block")
            w.Header().Set("Content-Security-Policy", "default-src 'self'")
            w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

            // Request tracking
            activeRequests.Inc()
            defer activeRequests.Dec()

            start := time.Now()
            next.ServeHTTP(w, r)
            
            // Record request duration
            duration := time.Since(start).Seconds()
            requestDuration.WithLabelValues(
                r.URL.Path,
                r.Method,
                fmt.Sprint(http.StatusOK),
            ).Observe(duration)
        })
    }

    // Register handlers with security middleware
    mux.Handle("/upload", secureMiddleware(http.HandlerFunc(handler.UploadHandler)))
    mux.Handle("/download", secureMiddleware(http.HandlerFunc(handler.DownloadHandler)))
    mux.Handle("/delete", secureMiddleware(http.HandlerFunc(handler.DeleteHandler)))
    
    // Health check endpoint
    mux.HandleFunc(healthCheckPath, func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("OK"))
    })

    // Metrics endpoint
    mux.Handle(metricsPath, promhttp.HandlerFor(registry, promhttp.HandlerOpts{
        EnableOpenMetrics: true,
    }))

    return &http.Server{
        Addr:              fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
        Handler:           mux,
        ReadTimeout:       cfg.Server.ReadTimeout,
        WriteTimeout:      cfg.Server.WriteTimeout,
        IdleTimeout:       cfg.Server.IdleTimeout,
        ReadHeaderTimeout: readHeaderTimeout,
        MaxHeaderBytes:    maxHeaderBytes,
    }
}