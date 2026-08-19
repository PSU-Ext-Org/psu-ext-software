# PSU-BE Parent

`psu-be-parent` contains shared Maven build configuration for PSU-EXT backend
modules.

## Purpose

- Defines the Java release used by backend modules.
- Imports the backend BOM.
- Centralizes Maven plugin versions and shared build defaults.

## Current Build Defaults

- Java release: `17`
- Compiler plugin: `maven-compiler-plugin`
- Test runner: `maven-surefire-plugin`
- Spring Boot packaging/run support: `spring-boot-maven-plugin`; application
  modules that declare it produce executable JARs during `package`

## Usage

Backend application or library modules should use this module as their Maven
parent unless they have a specific reason to own independent build settings.
