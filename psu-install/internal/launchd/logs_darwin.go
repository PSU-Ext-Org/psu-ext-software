// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build darwin

package launchd

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
)

// Logs follows the selected launch-agent log files.
func Logs(ctx context.Context, output io.Writer, home, service string) error {
	names := serviceNames
	if service != "" {
		if !knownService(service) {
			return fmt.Errorf("unknown service %q", service)
		}
		names = []string{service}
	}
	arguments := []string{"-n", "20", "-F"}
	for _, name := range names {
		arguments = append(arguments, filepath.Join(home, "logs", name+".log"))
	}
	return run(ctx, output, "tail", arguments...)
}
