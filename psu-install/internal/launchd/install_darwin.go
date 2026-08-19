// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build darwin

package launchd

import (
	"os"
	"path/filepath"
)

// Install writes launch agents without loading or starting them.
func Install(home string) error {
	unitDirectory, err := launchAgentDirectory()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(unitDirectory, 0700); err != nil {
		return err
	}
	for _, agent := range agents(home) {
		path := filepath.Join(unitDirectory, agent.label+".plist")
		if err := os.WriteFile(path, []byte(renderAgent(agent)), 0600); err != nil {
			return err
		}
	}
	return nil
}
