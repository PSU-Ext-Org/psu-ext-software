// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build darwin

package installer

import (
	"runtime"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/launchd"
)

func init() {
	if runtime.GOARCH != "arm64" {
		return
	}
	registerUnixPlatform("darwin-arm64", serviceAdapter{
		install: launchd.Install,
		command: launchd.Command,
		logs:    launchd.Logs,
	})
}
