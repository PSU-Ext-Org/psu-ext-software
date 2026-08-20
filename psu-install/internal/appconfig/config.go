// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package appconfig renders application and reverse-proxy configuration.
package appconfig

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

// Write renders all runtime configuration for the selected release.
func Write(home, release string, current state.State) error {
	configDir := filepath.Join(home, "config")
	dataDir := filepath.Join(home, "data")
	uiOrigin := fmt.Sprintf("http://localhost:%d", current.CaddyPort)
	if err := writeBackendConfigs(configDir, dataDir, uiOrigin, current); err != nil {
		return err
	}
	if err := writeRuntimeConfig(configDir, current); err != nil {
		return err
	}
	return writeCaddyConfig(configDir, release, current)
}

func writeBackendConfigs(configDir, dataDir, uiOrigin string, current state.State) error {
	proxy := fmt.Sprintf("server:\n  address: 127.0.0.1\n  port: %d\npsu:\n  transport:\n    usb:\n      platform: %s\n  connection:\n    devices:\n      file: %s\n  web:\n    cors:\n      allowed-origin: %s\n", current.ProxyPort, yamlQuote(usbPlatform()), yamlQuote(filepath.Join(dataDir, "devices.json")), yamlQuote(uiOrigin))
	runner := fmt.Sprintf("server:\n  address: 127.0.0.1\n  port: %d\npsu:\n  transport:\n    usb:\n      platform: %s\n  connection:\n    devices:\n      file: %s\n  scripts:\n    management:\n      user-directory: %s\n    storage:\n      directory: %s\n  web:\n    cors:\n      allowed-origin: %s\n", current.RunnerPort, yamlQuote(usbPlatform()), yamlQuote(filepath.Join(dataDir, "devices.json")), yamlQuote(filepath.Join(dataDir, "script-definitions")), yamlQuote(filepath.Join(dataDir, "script-storage")), yamlQuote(uiOrigin))
	if err := os.WriteFile(filepath.Join(configDir, "proxy.yaml"), []byte(proxy), 0600); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(configDir, "runner.yaml"), []byte(runner), 0600)
}

func writeRuntimeConfig(configDir string, current state.State) error {
	runtimeConfig, err := json.MarshalIndent(map[string]any{
		"proxy":        map[string]any{"scheme": "ws", "host": "localhost", "port": current.CaddyPort, "path": "/ws/scpi"},
		"scriptRunner": map[string]any{"scheme": "http", "host": "localhost", "port": current.CaddyPort, "rootPath": "/runner"},
	}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(configDir, "runtime-config.json"), append(runtimeConfig, '\n'), 0600)
}

func writeCaddyConfig(configDir, release string, current state.State) error {
	if runtime.GOOS == "windows" {
		return writeWindowsCaddyConfig(filepath.Dir(configDir), configDir, release, current)
	}
	caddy := fmt.Sprintf(`http://localhost:%d {
	route {
		handle /runtime-config.json {
			root * %s
			file_server
		}
		handle /ws/scpi {
			reverse_proxy 127.0.0.1:%d
		}
		handle_path /runner/* {
			reverse_proxy 127.0.0.1:%d
		}
		handle {
			root * %s
			file_server
		}
	}
}
`, current.CaddyPort, configDir, current.ProxyPort, current.RunnerPort, filepath.Join(release, "frontend"))
	return os.WriteFile(filepath.Join(configDir, "Caddyfile"), []byte(caddy), 0600)
}

func yamlQuote(value string) string {
	return fmt.Sprintf("%q", value)
}

func usbPlatform() string {
	if runtime.GOARCH == "arm64" {
		return "aarch64"
	}
	return "x86_64"
}
