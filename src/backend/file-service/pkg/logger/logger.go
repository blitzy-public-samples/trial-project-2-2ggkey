// Package logger provides structured logging functionality for the file service
// using zap logger with configurable levels, formats and rotation capabilities.
package logger

import (
	"errors"
	"os"
	"sync"

	"go.uber.org/zap" // v1.24.0
	"go.uber.org/zap/zapcore" // v1.24.0
	"gopkg.in/natefinch/lumberjack.v2" // v2.0.0
)

var (
	// defaultLogger holds the global logger instance
	defaultLogger *zap.Logger
	// loggerMutex ensures thread-safe logger operations
	loggerMutex sync.RWMutex
)

// LogConfig defines the configuration parameters for the logger
type LogConfig struct {
	// Level defines the minimum enabled logging level (debug, info, warn, error)
	Level string
	// FilePath specifies the log file location when file logging is enabled
	FilePath string
	// Development enables development mode with human-readable output
	Development bool
	// Rotation configures log file rotation settings
	Rotation RotationConfig
	// EnableConsole enables console output alongside file logging
	EnableConsole bool
	// Encoding specifies the log format (json or console)
	Encoding string
}

// RotationConfig defines settings for log file rotation
type RotationConfig struct {
	// MaxSize is the maximum size in megabytes before log rotation
	MaxSize int
	// MaxAge is the maximum number of days to retain old log files
	MaxAge int
	// MaxBackups is the maximum number of old log files to retain
	MaxBackups int
	// Compress determines if rotated logs should be compressed
	Compress bool
	// BackupTimeFormat specifies the time format for rotated files
	BackupTimeFormat string
}

// Validate checks and sets defaults for rotation configuration
func (rc *RotationConfig) Validate() error {
	if rc.MaxSize <= 0 {
		rc.MaxSize = 100 // Default 100MB
	}
	if rc.MaxAge <= 0 {
		rc.MaxAge = 365 // Default 1 year retention
	}
	if rc.MaxBackups <= 0 {
		rc.MaxBackups = 10 // Default 10 backups
	}
	if rc.BackupTimeFormat == "" {
		rc.BackupTimeFormat = "2006-01-02T15-04-05" // Default ISO-like format
	}
	return nil
}

// Validate checks the LogConfig and sets appropriate defaults
func (c *LogConfig) Validate() error {
	if c.Level == "" {
		c.Level = "info"
	}
	
	if c.Encoding == "" {
		c.Encoding = "json" // Default to JSON for production logging
	}
	if c.Encoding != "json" && c.Encoding != "console" {
		return errors.New("invalid encoding: must be 'json' or 'console'")
	}

	if c.FilePath != "" {
		// Verify file path is writable
		dir := c.FilePath[:len(c.FilePath)-len("/"+c.FilePath)]
		if err := os.MkdirAll(dir, 0755); err != nil {
			return errors.New("unable to create log directory: " + err.Error())
		}
	}

	return c.Rotation.Validate()
}

// InitLogger initializes the global logger instance with the provided configuration
func InitLogger(config *LogConfig) (*zap.Logger, error) {
	loggerMutex.Lock()
	defer loggerMutex.Unlock()

	if err := config.Validate(); err != nil {
		return nil, err
	}

	// Configure logging level
	level, err := zapcore.ParseLevel(config.Level)
	if err != nil {
		return nil, errors.New("invalid log level: " + err.Error())
	}

	// Configure encoders
	encoderConfig := zap.NewProductionEncoderConfig()
	if config.Development {
		encoderConfig = zap.NewDevelopmentEncoderConfig()
	}
	encoderConfig.TimeKey = "timestamp"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	var encoder zapcore.Encoder
	if config.Encoding == "console" {
		encoder = zapcore.NewConsoleEncoder(encoderConfig)
	} else {
		encoder = zapcore.NewJSONEncoder(encoderConfig)
	}

	// Configure outputs
	var cores []zapcore.Core
	
	// Add file output if configured
	if config.FilePath != "" {
		writer := &lumberjack.Logger{
			Filename:   config.FilePath,
			MaxSize:    config.Rotation.MaxSize,
			MaxAge:     config.Rotation.MaxAge,
			MaxBackups: config.Rotation.MaxBackups,
			Compress:   config.Rotation.Compress,
		}
		cores = append(cores, zapcore.NewCore(
			encoder,
			zapcore.AddSync(writer),
			level,
		))
	}

	// Add console output if enabled
	if config.EnableConsole {
		cores = append(cores, zapcore.NewCore(
			encoder,
			zapcore.AddSync(os.Stdout),
			level,
		))
	}

	// Create the logger
	core := zapcore.NewTee(cores...)
	logger := zap.New(core, 
		zap.AddCaller(), 
		zap.AddStacktrace(zapcore.ErrorLevel),
	)

	// Configure sampling for debug logs in production
	if !config.Development && level == zapcore.DebugLevel {
		logger = logger.WithOptions(zap.WrapCore(func(core zapcore.Core) zapcore.Core {
			return zapcore.NewSamplerWithOptions(core, time.Second, 100, 100)
		}))
	}

	// Update global logger instance
	defaultLogger = logger
	return logger, nil
}

// GetLogger returns the global logger instance, initializing with defaults if needed
func GetLogger() *zap.Logger {
	loggerMutex.RLock()
	if defaultLogger != nil {
		defer loggerMutex.RUnlock()
		return defaultLogger
	}
	loggerMutex.RUnlock()

	// Initialize with defaults if no logger exists
	loggerMutex.Lock()
	defer loggerMutex.Unlock()

	// Double-check after acquiring write lock
	if defaultLogger != nil {
		return defaultLogger
	}

	// Default configuration
	config := &LogConfig{
		Level:         "info",
		EnableConsole: true,
		Encoding:      "json",
		Development:   false,
		Rotation: RotationConfig{
			MaxSize:    100,
			MaxAge:     365,
			MaxBackups: 10,
			Compress:   true,
		},
	}

	logger, err := InitLogger(config)
	if err != nil {
		// Fallback to basic production logger
		logger, _ = zap.NewProduction()
	}
	defaultLogger = logger
	return defaultLogger
}