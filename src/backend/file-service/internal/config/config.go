// Package config provides configuration management for the file service with
// enhanced security features and monitoring capabilities.
package config

import (
	"crypto/tls"
	"errors"
	"os"
	"sync"
	"time"

	"github.com/caarlos0/env/v6" // v6.10.0
	"src/backend/file-service/pkg/logger"
)

const (
	// configVersion tracks configuration schema version
	configVersion = "1.0.0"
)

var (
	defaultConfig *Config
	configMutex   sync.RWMutex
)

// Config represents the complete service configuration with enhanced security
type Config struct {
	S3      S3Config         `env:"S3_"`
	Server  ServerConfig     `env:"SERVER_"`
	Logger  logger.LogConfig `env:"LOG_"`
	Metrics MetricsConfig    `env:"METRICS_"`
}

// S3Config holds AWS S3 storage configuration with security features
type S3Config struct {
	Region         string `env:"REGION" envDefault:"us-west-2"`
	Bucket         string `env:"BUCKET,required"`
	AccessKey      string `env:"ACCESS_KEY,required"`
	SecretKey      string `env:"SECRET_KEY,required,unset"`
	SessionToken   string `env:"SESSION_TOKEN"`
	Endpoint       string `env:"ENDPOINT"`
	UseSSL         bool   `env:"USE_SSL" envDefault:"true"`
	ForcePathStyle bool   `env:"FORCE_PATH_STYLE" envDefault:"false"`
	RetryMax       int    `env:"RETRY_MAX" envDefault:"3"`
}

// ServerConfig holds HTTP server configuration with TLS support
type ServerConfig struct {
	Host            string        `env:"HOST" envDefault:"0.0.0.0"`
	Port            int           `env:"PORT" envDefault:"8080"`
	ReadTimeout     time.Duration `env:"READ_TIMEOUT" envDefault:"30s"`
	WriteTimeout    time.Duration `env:"WRITE_TIMEOUT" envDefault:"30s"`
	IdleTimeout     time.Duration `env:"IDLE_TIMEOUT" envDefault:"60s"`
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" envDefault:"30s"`
	MaxFileSize     int64        `env:"MAX_FILE_SIZE" envDefault:"104857600"` // 100MB
	TLSEnabled      bool         `env:"TLS_ENABLED" envDefault:"false"`
	TLSCertFile     string       `env:"TLS_CERT_FILE"`
	TLSKeyFile      string       `env:"TLS_KEY_FILE"`
}

// MetricsConfig holds monitoring and metrics configuration
type MetricsConfig struct {
	Enabled     bool   `env:"ENABLED" envDefault:"true"`
	Path        string `env:"PATH" envDefault:"/metrics"`
	ServiceName string `env:"SERVICE_NAME" envDefault:"file-service"`
}

// LoadConfig loads configuration from environment variables with enhanced validation
func LoadConfig() (*Config, error) {
	cfg := &Config{}

	// Parse environment variables
	opts := env.Options{
		Prefix: "APP_",
		OnSet: func(tag string, value interface{}, isDefault bool) {
			// Log configuration changes but mask sensitive values
			if isSensitive(tag) {
				value = "****"
			}
		},
	}

	if err := env.Parse(cfg, opts); err != nil {
		return nil, errors.New("failed to parse environment variables: " + err.Error())
	}

	// Validate configuration
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	// Set global configuration
	configMutex.Lock()
	defaultConfig = cfg
	configMutex.Unlock()

	return cfg, nil
}

// GetConfig returns the global configuration instance with thread-safe access
func GetConfig() *Config {
	configMutex.RLock()
	defer configMutex.RUnlock()

	if defaultConfig == nil {
		// Initialize with defaults if not set
		cfg, err := LoadConfig()
		if err != nil {
			panic("failed to load configuration: " + err.Error())
		}
		return cfg
	}

	return defaultConfig
}

// validate performs comprehensive configuration validation
func (cfg *Config) validate() error {
	// Validate S3 configuration
	if err := cfg.validateS3Config(); err != nil {
		return errors.New("S3 configuration error: " + err.Error())
	}

	// Validate server configuration
	if err := cfg.validateServerConfig(); err != nil {
		return errors.New("server configuration error: " + err.Error())
	}

	// Validate logger configuration
	if err := cfg.Logger.Validate(); err != nil {
		return errors.New("logger configuration error: " + err.Error())
	}

	return nil
}

// validateS3Config validates S3 configuration settings
func (cfg *Config) validateS3Config() error {
	if cfg.S3.Bucket == "" {
		return errors.New("S3 bucket name is required")
	}

	if cfg.S3.Region == "" {
		return errors.New("S3 region is required")
	}

	if cfg.S3.RetryMax < 0 {
		return errors.New("invalid retry max value")
	}

	// Validate credentials
	if cfg.S3.AccessKey == "" || cfg.S3.SecretKey == "" {
		return errors.New("S3 credentials are required")
	}

	return nil
}

// validateServerConfig validates server configuration including TLS settings
func (cfg *Config) validateServerConfig() error {
	if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
		return errors.New("invalid port number")
	}

	if cfg.Server.MaxFileSize < 0 {
		return errors.New("invalid max file size")
	}

	// Validate timeouts
	if cfg.Server.ReadTimeout <= 0 || cfg.Server.WriteTimeout <= 0 || 
	   cfg.Server.IdleTimeout <= 0 || cfg.Server.ShutdownTimeout <= 0 {
		return errors.New("invalid timeout values")
	}

	// Validate TLS configuration if enabled
	if cfg.Server.TLSEnabled {
		if err := cfg.validateTLSConfig(); err != nil {
			return err
		}
	}

	return nil
}

// validateTLSConfig validates TLS configuration settings
func (cfg *Config) validateTLSConfig() error {
	if cfg.Server.TLSCertFile == "" || cfg.Server.TLSKeyFile == "" {
		return errors.New("TLS certificate and key files are required when TLS is enabled")
	}

	// Verify TLS files exist
	if _, err := os.Stat(cfg.Server.TLSCertFile); err != nil {
		return errors.New("TLS certificate file not found")
	}
	if _, err := os.Stat(cfg.Server.TLSKeyFile); err != nil {
		return errors.New("TLS key file not found")
	}

	// Verify TLS certificate and key
	_, err := tls.LoadX509KeyPair(cfg.Server.TLSCertFile, cfg.Server.TLSKeyFile)
	if err != nil {
		return errors.New("invalid TLS certificate or key: " + err.Error())
	}

	return nil
}

// isSensitive determines if a configuration tag contains sensitive information
func isSensitive(tag string) bool {
	sensitiveFields := []string{
		"SECRET_KEY",
		"ACCESS_KEY",
		"SESSION_TOKEN",
		"PASSWORD",
		"KEY",
	}

	for _, field := range sensitiveFields {
		if tag == field {
			return true
		}
	}
	return false
}