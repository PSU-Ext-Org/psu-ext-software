// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package systemd installs and controls Linux user services.
package systemd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
)

var serviceUnits = []string{
	"psu-ext-proxy.service",
	"psu-ext-runner.service",
	"psu-ext-caddy.service",
}

// Install writes PSU-EXT user units and reloads the systemd user manager.
func Install(home string) error {
	unitDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	unitDir = filepath.Join(unitDir, "systemd", "user")
	if err := os.MkdirAll(unitDir, 0700); err != nil {
		return err
	}
	current := filepath.Join(home, "current")
	config := filepath.Join(home, "config")
	data := filepath.Join(home, "data")
	units := map[string]string{
		"psu-ext-proxy.service":  javaUnit("PSU-EXT Proxy", current, config, data, "psu-be-proxy.jar", "proxy.yaml"),
		"psu-ext-runner.service": javaUnit("PSU-EXT Script Runner", current, config, data, "psu-be-script-runner.jar", "runner.yaml"),
		"psu-ext-caddy.service":  caddyUnit(current, config),
	}
	for name, content := range units {
		if err := os.WriteFile(filepath.Join(unitDir, name), []byte(content), 0600); err != nil {
			return err
		}
	}
	return exec.Command("systemctl", "--user", "daemon-reload").Run()
}

// Command invokes a lifecycle operation for the complete service set.
func Command(ctx context.Context, output io.Writer, command string) error {
	args := append([]string{"--user", command}, serviceUnits...)
	if command == "status" {
		args = append([]string{"--user", "--no-pager", "status"}, serviceUnits...)
	}
	return run(ctx, output, "systemctl", args...)
}

// Logs streams journal entries for one service or for the complete stack.
func Logs(ctx context.Context, output io.Writer, service string) error {
	units := map[string]string{"proxy": serviceUnits[0], "runner": serviceUnits[1], "caddy": serviceUnits[2]}
	if service != "" {
		unit, ok := units[service]
		if !ok {
			return fmt.Errorf("unknown service %q", service)
		}
		return run(ctx, output, "journalctl", "--user", "-fu", unit)
	}
	return run(ctx, output, "journalctl", "--user", "-f", "-u", serviceUnits[0], "-u", serviceUnits[1], "-u", serviceUnits[2])
}

func run(ctx context.Context, output io.Writer, command string, args ...string) error {
	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Stdout = output
	cmd.Stderr = output
	return cmd.Run()
}

func javaUnit(description, current, config, data, jar, override string) string {
	return fmt.Sprintf(`[Unit]
Description=%s
After=network-online.target

[Service]
Type=simple
WorkingDirectory=%s
ExecStart=%s/runtime/bin/java -jar %s/apps/%s --spring.config.additional-location=file:%s/%s
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
`, description, data, current, current, jar, config, override)
}

func caddyUnit(current, config string) string {
	return fmt.Sprintf(`[Unit]
Description=PSU-EXT Caddy frontend
After=psu-ext-proxy.service psu-ext-runner.service

[Service]
Type=simple
ExecStart=%s/bin/caddy run --config %s/Caddyfile --adapter caddyfile
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
`, current, config)
}
