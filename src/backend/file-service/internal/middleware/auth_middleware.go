// Package middleware provides authentication and authorization middleware for the file service
// with comprehensive security features including JWT validation, RBAC, and audit logging.
package middleware

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin" // v1.9.0
	"github.com/golang-jwt/jwt/v5" // v5.0.0
	"github.com/patrickmn/go-cache" // v2.1.0

	"src/backend/file-service/internal/config"
	"src/backend/file-service/pkg/logger"
)

const (
	bearerSchema   = "Bearer "
	authHeader     = "Authorization"
	userContextKey = "user"
)

var (
	// tokenCache provides caching for validated tokens to improve performance
	tokenCache = cache.New(5*time.Minute, 10*time.Minute)
	// maxTokenAge defines the maximum age of tokens that will be accepted
	maxTokenAge = 24 * time.Hour

	// Common errors
	errInvalidToken     = errors.New("invalid or expired token")
	errMissingToken     = errors.New("missing authorization token")
	errInvalidBearer    = errors.New("invalid bearer format")
	errTokenValidation  = errors.New("token validation failed")
	errInsufficientRole = errors.New("insufficient permissions")
)

// Claims extends jwt.Claims with custom fields for enhanced RBAC
type Claims struct {
	UserID       string    `json:"user_id"`
	Email        string    `json:"email"`
	Roles        []string  `json:"roles"`
	Permissions  []string  `json:"permissions"`
	IssuedAt     time.Time `json:"iat"`
	DeviceID     string    `json:"device_id,omitempty"`
	jwt.RegisteredClaims
}

// AuthMiddleware creates a Gin middleware for JWT authentication and RBAC
func AuthMiddleware() gin.HandlerFunc {
	// Initialize logger and config
	log := logger.GetLogger()
	cfg := config.GetConfig()

	return func(c *gin.Context) {
		// Set request timeout
		ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*10)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)

		// Extract token
		tokenString, err := extractToken(c)
		if err != nil {
			log.Error("Token extraction failed",
				zap.Error(err),
				zap.String("path", c.Request.URL.Path),
				zap.String("ip", c.ClientIP()),
			)
			c.AbortWithStatusJSON(401, gin.H{"error": err.Error()})
			return
		}

		// Check token cache
		if cachedClaims, found := tokenCache.Get(tokenString); found {
			c.Set(userContextKey, cachedClaims)
			c.Next()
			return
		}

		// Validate token
		claims, err := validateToken(tokenString)
		if err != nil {
			log.Error("Token validation failed",
				zap.Error(err),
				zap.String("path", c.Request.URL.Path),
				zap.String("ip", c.ClientIP()),
			)
			c.AbortWithStatusJSON(401, gin.H{"error": errTokenValidation.Error()})
			return
		}

		// Validate token age
		if time.Since(claims.IssuedAt) > maxTokenAge {
			log.Warn("Token exceeded maximum age",
				zap.String("user_id", claims.UserID),
				zap.Time("issued_at", claims.IssuedAt),
			)
			c.AbortWithStatusJSON(401, gin.H{"error": "token expired"})
			return
		}

		// Log successful authentication
		log.Info("Authentication successful",
			zap.String("user_id", claims.UserID),
			zap.String("email", claims.Email),
			zap.Strings("roles", claims.Roles),
			zap.String("path", c.Request.URL.Path),
		)

		// Cache validated claims
		tokenCache.Set(tokenString, claims, cache.DefaultExpiration)

		// Set claims in context
		c.Set(userContextKey, claims)
		c.Next()
	}
}

// extractToken extracts the JWT token from the Authorization header
func extractToken(c *gin.Context) (string, error) {
	header := c.GetHeader(authHeader)
	if header == "" {
		return "", errMissingToken
	}

	if !strings.HasPrefix(header, bearerSchema) {
		return "", errInvalidBearer
	}

	token := strings.TrimPrefix(header, bearerSchema)
	if token == "" {
		return "", errMissingToken
	}

	return token, nil
}

// validateToken performs comprehensive JWT token validation
func validateToken(tokenString string) (*Claims, error) {
	cfg := config.GetConfig()
	claims := &Claims{}

	// Parse and validate token
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(cfg.JWT.SigningKey), nil
	})

	if err != nil {
		return nil, fmt.Errorf("token parsing failed: %w", err)
	}

	if !token.Valid {
		return nil, errInvalidToken
	}

	// Validate required claims
	if claims.UserID == "" || claims.Email == "" || len(claims.Roles) == 0 {
		return nil, errors.New("missing required claims")
	}

	// Validate token freshness
	if claims.IssuedAt.IsZero() || time.Since(claims.IssuedAt) > maxTokenAge {
		return nil, errors.New("token expired or invalid issuance time")
	}

	return claims, nil
}

// GetUserFromContext extracts the user claims from the Gin context
func GetUserFromContext(c *gin.Context) (*Claims, error) {
	value, exists := c.Get(userContextKey)
	if !exists {
		return nil, errors.New("user not found in context")
	}

	claims, ok := value.(*Claims)
	if !ok {
		return nil, errors.New("invalid user claims type")
	}

	return claims, nil
}

// RequireRoles creates middleware to enforce role-based access control
func RequireRoles(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := GetUserFromContext(c)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "authentication required"})
			return
		}

		// Check if user has any of the required roles
		hasRole := false
		for _, requiredRole := range roles {
			for _, userRole := range claims.Roles {
				if requiredRole == userRole {
					hasRole = true
					break
				}
			}
			if hasRole {
				break
			}
		}

		if !hasRole {
			logger.GetLogger().Warn("Insufficient permissions",
				zap.String("user_id", claims.UserID),
				zap.Strings("user_roles", claims.Roles),
				zap.Strings("required_roles", roles),
				zap.String("path", c.Request.URL.Path),
			)
			c.AbortWithStatusJSON(403, gin.H{"error": errInsufficientRole.Error()})
			return
		}

		c.Next()
	}
}