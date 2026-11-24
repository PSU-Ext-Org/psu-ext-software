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

package taskscheduler

import (
	"context"
	_ "embed"
	"fmt"
	"io"
	"os/exec"
	"strings"
)

//go:embed uninstall.ps1
var uninstallScript string

// Uninstall removes the current user's tasks whose actions target this installation.
func Uninstall(ctx context.Context, output io.Writer, home string) error {
	// Pass script source through stdin and the installation path as data.
	const readScript = "& ([ScriptBlock]::Create([Console]::In.ReadToEnd()))"
	cmd := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", readScript)
	cmd.Stdin = strings.NewReader(uninstallScript)
	cmd.Env = append(cmd.Environ(), "PSU_EXT_UNINSTALL_HOME="+home)
	cmd.Stdout, cmd.Stderr = output, output

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("unregister Windows scheduled tasks: %w", err)
	}
	return nil
}
