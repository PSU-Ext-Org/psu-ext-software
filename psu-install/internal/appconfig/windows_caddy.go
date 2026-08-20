// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package appconfig

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

func writeWindowsCaddyConfig(home, configDir, release string, current state.State) error {
	caddy := fmt.Sprintf(`{
	log default {
		output file %s {
			roll_size 10MiB
			roll_keep 5
		}
	}
}

http://localhost:%d {
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
`, caddyQuote(filepath.Join(home, "logs", "caddy.log")), current.CaddyPort, caddyQuote(configDir), current.ProxyPort, current.RunnerPort, caddyQuote(filepath.Join(release, "frontend")))
	return os.WriteFile(filepath.Join(configDir, "Caddyfile"), []byte(caddy), 0600)
}

func caddyQuote(value string) string {
	return strconv.Quote(filepath.ToSlash(value))
}
