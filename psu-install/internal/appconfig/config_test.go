// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package appconfig

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

func TestCaddyConfigQuotesPathsAndConfiguresWindowsLog(t *testing.T) {
	home := filepath.Join(t.TempDir(), "PSU & EXT")
	config := filepath.Join(home, "config")
	if err := os.MkdirAll(config, 0700); err != nil {
		t.Fatal(err)
	}
	current := state.State{CaddyPort: 18080, ProxyPort: 18081, RunnerPort: 18082}
	if err := writeWindowsCaddyConfig(home, config, filepath.Join(home, "release 1"), current); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(config, "Caddyfile"))
	if err != nil {
		t.Fatal(err)
	}
	configuration := string(content)
	if !strings.Contains(configuration, `root * "`) || !strings.Contains(configuration, "release 1") {
		t.Fatalf("Caddy paths are not quoted:\n%s", configuration)
	}
	for _, expected := range []string{"log default", "caddy.log", "roll_size 10MiB", "roll_keep 5"} {
		if !strings.Contains(configuration, expected) {
			t.Fatalf("Windows Caddy log config lacks %q:\n%s", expected, configuration)
		}
	}
}
