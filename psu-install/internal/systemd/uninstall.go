/**
 * Copyright 2026 The PSU-EXT Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package systemd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
)

// Uninstall stops this installation's units before removing their definitions.
func Uninstall(ctx context.Context, output io.Writer, home string) error {
	config, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	// A previous run may have removed a unit file before its final reload.
	if err := run(ctx, output, "systemctl", "--user", "daemon-reload"); err != nil {
		return fmt.Errorf("refresh user unit definitions: %w", err)
	}
	for i := len(serviceUnits) - 1; i >= 0; i-- {
		if err := removeUnit(ctx, output, home, config, serviceUnits[i]); err != nil {
			return err
		}
	}
	return run(ctx, output, "systemctl", "--user", "daemon-reload")
}

// removeUnit stops the loaded service before removing its on-disk registration.
func removeUnit(ctx context.Context, output io.Writer, home, config, unit string) error {
	path := filepath.Join(config, "systemd", "user", unit)
	fragment, err := loadedFragment(ctx, unit)
	if err != nil {
		return err
	}

	if err := verifyUnitFile(path, home, unit); err != nil {
		// A previous uninstall may already have removed both registrations.
		if os.IsNotExist(err) && fragment == "" {
			return nil
		}
		return err
	}

	if fragment != "" {
		if err := verifyFragment(path, fragment); err != nil {
			return err
		}
		if err := run(ctx, output, "systemctl", "--user", "stop", unit); err != nil {
			return fmt.Errorf("stop %s: %w", unit, err)
		}
	}

	if err := run(ctx, output, "systemctl", "--user", "disable", unit); err != nil {
		return fmt.Errorf("disable %s: %w", unit, err)
	}
	return os.Remove(path)
}

// verifyFragment accepts a systemd link only when it identifies the verified unit file.
func verifyFragment(path, fragment string) error {
	if path == fragment {
		return nil
	}
	expected, err := os.Stat(path)
	if err != nil {
		return err
	}
	active, err := os.Stat(fragment)
	if err != nil {
		return err
	}
	if !os.SameFile(expected, active) {
		return fmt.Errorf("unexpected fragment %s for unit file %s", fragment, path)
	}
	return nil
}

// loadedFragment returns the active unit file path, or an empty string for a missing unit.
func loadedFragment(ctx context.Context, unit string) (string, error) {
	cmd := exec.CommandContext(ctx, "systemctl", "--user", "show", "--property=LoadState,FragmentPath,ActiveState", unit)
	status, err := cmd.CombinedOutput()
	lines := strings.Split(string(status), "\n")
	if slices.Contains(lines, "LoadState=not-found") {
		if !slices.Contains(lines, "ActiveState=inactive") && !slices.Contains(lines, "ActiveState=failed") {
			return "", fmt.Errorf("cannot verify that %s has stopped: %s", unit, status)
		}
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("query %s: %w: %s", unit, err, status)
	}

	for _, line := range lines {
		if path, ok := strings.CutPrefix(line, "FragmentPath="); ok && path != "" {
			return path, nil
		}
	}
	return "", fmt.Errorf("missing fragment path for %s", unit)
}

// verifyUnitFile checks the configured executable against the selected installation.
func verifyUnitFile(path, home, unit string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	program := "runtime/bin/java"
	if unit == "psu-ext-caddy.service" {
		program = "bin/caddy"
	}
	if !strings.Contains(string(data), "\nExecStart="+filepath.Join(home, "current", program)+" ") {
		return fmt.Errorf("cannot verify %s belongs to %s", unit, home)
	}
	return nil
}
