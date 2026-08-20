// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build windows

package installer

import (
	"context"
	"io"
	"runtime"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/taskscheduler"
)

func init() {
	if runtime.GOARCH != "amd64" {
		return
	}
	registerPlatform(platformAdapter{
		key: "windows-amd64",
		services: serviceAdapter{
			install:         installScheduledTasks,
			commandWithHome: commandScheduledTasks,
			logs:            scheduledTaskLogs,
		},
		extract:  release.ExtractZip,
		validate: release.ValidateWindows,
		activate: activateWindowsRelease,
	})
}

func installScheduledTasks(home string) error {
	return taskscheduler.Install(home)
}

func commandScheduledTasks(ctx context.Context, output io.Writer, home, command string) error {
	return taskscheduler.Command(ctx, output, home, command)
}

func scheduledTaskLogs(ctx context.Context, output io.Writer, home, service string) error {
	return taskscheduler.Logs(ctx, output, home, service)
}

func activateWindowsRelease(_, _ string) error {
	return nil
}
