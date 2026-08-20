// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package installer

import (
	"context"
	"fmt"
	"io"
	"runtime"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
)

type serviceAdapter struct {
	install         func(home string) error
	command         func(ctx context.Context, output io.Writer, command string) error
	commandWithHome func(ctx context.Context, output io.Writer, home, command string) error
	logs            func(ctx context.Context, output io.Writer, home, service string) error
}

type platformAdapter struct {
	key      string
	services serviceAdapter
	extract  func(archive, destination string) error
	validate func(directory string) error
	activate func(home, directory string) error
}

var activePlatform platformAdapter

// registerPlatform is called by the platform-specific adapter selected by Go's
// build constraints. Supporting another target only requires another adapter.
func registerPlatform(platform platformAdapter) {
	activePlatform = platform
}

// registerUnixPlatform supplies the shared tar, executable, and symlink
// behavior used by Unix targets. A structurally different target registers its
// own hooks without changing installer orchestration.
func registerUnixPlatform(key string, services serviceAdapter) {
	registerPlatform(platformAdapter{
		key:      key,
		services: services,
		extract:  release.ExtractTarGz,
		validate: release.Validate,
		activate: release.Activate,
	})
}

func releasePlatform() (string, error) {
	if activePlatform.key == "" {
		return "", fmt.Errorf("%s/%s is not supported", runtime.GOOS, runtime.GOARCH)
	}
	return activePlatform.key, nil
}

func installServices(home string) error {
	return activePlatform.services.install(home)
}

func commandServices(ctx context.Context, output io.Writer, home, command string) error {
	if activePlatform.services.commandWithHome != nil {
		return activePlatform.services.commandWithHome(ctx, output, home, command)
	}
	return activePlatform.services.command(ctx, output, command)
}

func serviceLogs(ctx context.Context, output io.Writer, home, service string) error {
	return activePlatform.services.logs(ctx, output, home, service)
}

func extractRelease(archive, destination string) error {
	return activePlatform.extract(archive, destination)
}

func validateRelease(directory string) error {
	return activePlatform.validate(directory)
}

func activateRelease(home, directory string) error {
	return activePlatform.activate(home, directory)
}
