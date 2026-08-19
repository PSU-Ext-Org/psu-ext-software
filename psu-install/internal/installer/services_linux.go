// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package installer

import (
	"context"
	"io"
	"runtime"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/systemd"
)

func init() {
	if runtime.GOARCH != "amd64" {
		return
	}
	registerUnixPlatform("linux-amd64", serviceAdapter{
		install: installSystemdServices,
		command: commandSystemdServices,
		logs:    systemdLogs,
	})
}

func installSystemdServices(home string) error {
	return systemd.Install(home)
}

func commandSystemdServices(ctx context.Context, output io.Writer, command string) error {
	return systemd.Command(ctx, output, command)
}

func systemdLogs(ctx context.Context, output io.Writer, _ string, service string) error {
	return systemd.Logs(ctx, output, service)
}
