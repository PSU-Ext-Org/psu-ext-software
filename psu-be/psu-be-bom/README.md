# PSU-BE BOM

`psu-be-bom` is the dependency-version catalog for PSU-EXT backend modules.

## Purpose

- Imports the Spring Boot dependency BOM.
- Keeps dependency versions centralized for backend modules.
- Lets feature modules declare managed dependencies without repeating versions.

## Current Versions

- Spring Boot: `4.0.6`

## Usage

Backend parent/build modules import this BOM through Maven dependency management.
Application modules should prefer managed dependency versions from this module
instead of declaring versions locally.
