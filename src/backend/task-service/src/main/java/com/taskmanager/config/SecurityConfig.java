package com.taskmanager.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Security configuration class for Task Management Service.
 * Implements Spring Security settings including JWT authentication,
 * CORS policies, and endpoint authorization rules.
 * 
 * @version 1.0
 * @since 2024-01-01
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Paths that don't require authentication
    private static final List<String> PERMITTED_PATHS = Arrays.asList(
        "/api/v1/auth/**",
        "/swagger-ui/**",
        "/v3/api-docs/**",
        "/actuator/health"
    );

    // Paths that require authentication
    private static final List<String> SECURED_PATHS = Arrays.asList(
        "/api/v1/tasks/**",
        "/api/v1/projects/**"
    );

    private final String jwtSecret;
    private final long jwtExpiration;

    /**
     * Constructor to initialize security configuration with JWT settings.
     */
    public SecurityConfig() {
        // These values should be loaded from application.yml in production
        this.jwtSecret = System.getProperty("jwt.secret", "defaultSecretKey");
        this.jwtExpiration = Long.parseLong(
            System.getProperty("jwt.expiration", "86400000")
        );
    }

    /**
     * Configures the security filter chain with authentication and authorization rules.
     *
     * @param http HttpSecurity object to configure
     * @return Configured SecurityFilterChain
     * @throws Exception if configuration fails
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // Disable CSRF as we're using JWT tokens
            .csrf(csrf -> csrf.disable())
            
            // Configure CORS
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            // Configure session management to stateless
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // Configure authorization rules
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(PERMITTED_PATHS.toArray(new String[0])).permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/projects/**").hasAnyRole("ADMIN", "MANAGER")
                .requestMatchers("/api/v1/tasks/**").authenticated()
                .anyRequest().authenticated())
            
            // Add JWT filter (would be implemented in a separate JwtAuthenticationFilter class)
            // .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class)
            
            // Configure exception handling
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.sendError(401, "Unauthorized");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.sendError(403, "Access Denied");
                }))
            
            .build();
    }

    /**
     * Creates password encoder bean for secure password hashing.
     *
     * @return BCryptPasswordEncoder with strength 12
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /**
     * Configures CORS policy for cross-origin requests.
     *
     * @return CorsConfigurationSource with configured CORS policies
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Allow requests from trusted origins (should be configured from properties in production)
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:3000"));
        
        // Configure allowed methods
        configuration.setAllowedMethods(Arrays.asList(
            "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"
        ));
        
        // Configure allowed headers
        configuration.setAllowedHeaders(Arrays.asList(
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "Accept",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
        ));
        
        // Expose headers for JWT
        configuration.setExposedHeaders(Arrays.asList(
            "Authorization",
            "X-Total-Count",
            "Link"
        ));
        
        // Configure other CORS settings
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        
        return source;
    }
}