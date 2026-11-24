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

package launchd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Uninstall unloads the user's agents and removes their installed plists.
func Uninstall(ctx context.Context, output io.Writer, home string) error {
	dir, err := launchAgentDirectory()
	if err != nil {
		return err
	}
	for _, agent := range agents(home) {
		if err := removeAgent(ctx, output, home, dir, agent); err != nil {
			return err
		}
	}
	return nil
}

// removeAgent verifies the installed plist before unloading and removing it.
func removeAgent(ctx context.Context, output io.Writer, home, dir string, agent agent) error {
	path := filepath.Join(dir, agent.label+".plist")
	data, err := os.ReadFile(path)
	missing := os.IsNotExist(err)
	if err != nil && !missing {
		return err
	}
	if !missing && !strings.Contains(string(data), "<string>"+escapeXML(agent.executable)+"</string>") {
		return fmt.Errorf("cannot verify %s belongs to %s", path, home)
	}

	if err := unloadAgent(ctx, output, agent); err != nil {
		return err
	}
	if missing {
		return nil
	}
	return os.Remove(path)
}

// unloadAgent checks the loaded program independently of the plist, which may already be gone.
func unloadAgent(ctx context.Context, output io.Writer, agent agent) error {
	target := userDomain() + "/" + agent.label
	status, err := exec.CommandContext(ctx, "launchctl", "print", target).CombinedOutput()
	if err != nil {
		if strings.Contains(string(status), "Could not find service") {
			return nil
		}
		return fmt.Errorf("query %s: %w: %s", target, err, status)
	}

	if !strings.Contains(string(status), "program = "+agent.executable+"\n") {
		return fmt.Errorf("unexpected executable for %s", target)
	}
	if err := run(ctx, output, "launchctl", "bootout", target); err != nil {
		return fmt.Errorf("unload %s: %w", target, err)
	}
	return nil
}
