package com.psuext.script.web.config;

/*-
 * #%L
 * PSU-BE Script Runner
 * %%
 * Copyright (C) 2026 The PSU-EXT Authors
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * Allows the local PSU-EXT frontend to call the Script Runner HTTP API.
 *
 * The default is the Vite development origin. Deployments should override the
 * {@code psu.web.cors.allowed-origin} property with their hosted frontend origin.
 */
@Configuration
public class ScriptRunnerCorsConfiguration implements WebMvcConfigurer {

    private final String allowedOrigin;

    /**
     * Creates the CORS configuration.
     *
     * @param allowedOrigin browser origin permitted to access Script Runner APIs
     */
    public ScriptRunnerCorsConfiguration(
            @Value("${psu.web.cors.allowed-origin:http://localhost:5173}") String allowedOrigin) {
        this.allowedOrigin = allowedOrigin;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigin)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Accept");
        registry.addMapping("/actuator/health")
                .allowedOrigins(allowedOrigin)
                .allowedMethods("GET", "OPTIONS");
    }

    /**
     * Adds CORS headers to Actuator health responses, which use a management handler outside MVC mappings.
     *
     * @return registered filter for the public health endpoint
     */
    @Bean
    public FilterRegistrationBean<CorsFilter> actuatorHealthCorsFilter() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigin));
        configuration.setAllowedMethods(List.of("GET", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "Accept"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/actuator/health", configuration);
        FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(new CorsFilter(source));
        registration.addUrlPatterns("/actuator/health");
        registration.setOrder(-102);
        return registration;
    }
}
