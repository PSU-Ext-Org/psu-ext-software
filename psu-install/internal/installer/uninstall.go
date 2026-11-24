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

package installer

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
)

// managedEntries lists installation-owned paths in removal order, with state last.
var managedEntries = []string{
	"current", "current.new", "releases", "logs",
	"config/Caddyfile", "config/proxy.yaml", "config/runner.yaml", "config/runtime-config.json",
	"data/devices.json", "data/script-definitions", "data/script-storage",
	"install-state.json.tmp", "install-state.json",
}

// inside reports whether path is equal to or beneath parent.
func inside(parent, path string) bool {
	rel, err := filepath.Rel(parent, path)
	return err == nil && (rel == "." || filepath.IsLocal(rel))
}

// removalCommand pairs a shell with the command that removes the CLI.
type removalCommand struct {
	shell string
	text  string
}

// removalCommands quotes the executable path for each supported shell.
func removalCommands(platform, exe string) []removalCommand {
	if platform == "windows-amd64" {
		powerShell := "Remove-Item -LiteralPath '" + strings.ReplaceAll(exe, "'", "''") + "'"
		return []removalCommand{
			{shell: "Command Prompt (CMD)", text: cmdRemovalCommand(exe, powerShell)},
			{shell: "PowerShell", text: powerShell},
		}
	}
	return []removalCommand{{text: "rm -- '" + strings.ReplaceAll(exe, "'", "'\\''") + "'"}}
}

// cmdRemovalCommand protects paths that CMD could expand as environment variables.
func cmdRemovalCommand(exe, powerShell string) string {
	if !strings.ContainsAny(exe, "%!") {
		return `del /f /q "` + exe + `"`
	}

	// PowerShell accepts UTF-16LE encoded commands with no CMD metacharacters.
	var encoded []byte
	for _, unit := range utf16.Encode([]rune(powerShell)) {
		encoded = binary.LittleEndian.AppendUint16(encoded, unit)
	}
	return "powershell.exe -NoProfile -NonInteractive -EncodedCommand " + base64.StdEncoding.EncodeToString(encoded)
}

// printRemovalInstructions displays commands after the application has been removed.
func printRemovalInstructions(output io.Writer, platform, exe string) error {
	if _, err := fmt.Fprintln(output, "PSU-EXT uninstalled. To remove the CLI executable, use the command for your shell."); err != nil {
		return err
	}
	for _, command := range removalCommands(platform, exe) {
		if command.shell != "" {
			if _, err := fmt.Fprintln(output, command.shell); err != nil {
				return err
			}
		}
		if _, err := fmt.Fprintln(output, command.text); err != nil {
			return err
		}
	}
	return nil
}

// Uninstall removes this user's installation after explicit confirmation.
func (m *Manager) Uninstall(ctx context.Context, input io.Reader) error {
	target, err := resolveInstallation(m.home)
	if err != nil {
		return err
	}
	entries := uninstallEntries(m.platform)
	var root *os.Root
	if target.exists {
		root, err = os.OpenRoot(target.home)
		if err != nil {
			return err
		}
		defer root.Close()
		entries, err = target.removalEntries(root, entries, m.platform)
		if err != nil {
			return err
		}
	}
	exe, err := executableToKeep(target.home, entries)
	if err != nil {
		return err
	}

	confirmed, err := confirmUninstall(input, m.stdout, target.home)
	if err != nil || !confirmed {
		return err
	}

	// Stop writers before removing the data they use.
	if err := activePlatform.services.uninstall(ctx, m.stdout, target.home); err != nil {
		return fmt.Errorf("remove PSU-EXT services: %w", err)
	}
	if root != nil {
		if err := removeInstallation(ctx, m.stdout, root, target.home, entries); err != nil {
			return err
		}
	}

	return printRemovalInstructions(m.stdout, m.platform, exe)
}

// installation holds the resolved directories used for uninstall safety checks.
type installation struct {
	home, userHome string
	exists         bool
}

// resolveInstallation rejects a filesystem root, an account home, or a symlink as the target.
func resolveInstallation(path string) (installation, error) {
	home, err := filepath.Abs(path)
	if err != nil {
		return installation{}, err
	}

	userHome, err := os.UserHomeDir()
	if err != nil {
		return installation{}, err
	}
	userHome, err = filepath.EvalSymlinks(userHome)
	if err != nil {
		return installation{}, err
	}

	info, err := os.Lstat(home)
	exists := err == nil
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return installation{}, err
	}
	if exists {
		if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return installation{}, fmt.Errorf("unsafe installation directory %q", home)
		}
		home, err = filepath.EvalSymlinks(home)
		if err != nil {
			return installation{}, err
		}
	}

	if filepath.Dir(home) == home || inside(home, userHome) {
		return installation{}, fmt.Errorf("unsafe installation directory %q", home)
	}
	return installation{home: home, userHome: userHome, exists: exists}, nil
}

// executableToKeep resolves the CLI path and verifies it survives automatic cleanup.
func executableToKeep(home string, entries []string) (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}

	for _, entry := range entries {
		if inside(filepath.Join(home, entry), exe) {
			return "", fmt.Errorf("move the CLI outside %s before uninstalling", filepath.Join(home, entry))
		}
	}
	return exe, nil
}

// uninstallEntries includes the task definitions generated by the Windows installer.
func uninstallEntries(platform string) []string {
	entries := append([]string{}, managedEntries...)
	if platform == "windows-amd64" {
		for _, name := range []string{"proxy", "runner", "caddy"} {
			entries = append([]string{"config/tasks/psu-ext-" + name + ".xml"}, entries...)
		}
	}
	return entries
}

// removalEntries selects managed paths before the user confirms deletion.
func (target installation) removalEntries(root *os.Root, entries []string, platform string) ([]string, error) {
	if err := validateLayout(root, target.home); err != nil {
		return nil, err
	}
	relative, err := filepath.Rel(filepath.Join(target.userHome, ".psu-ext"), target.home)
	if err == nil && relative == "." {
		return entries, nil
	}
	entries, err = sharedDirectoryEntries(root, entries, platform)
	if err != nil {
		return nil, err
	}
	return entries, verifyInstallationMarker(root, target.home, entries)
}

// validateLayout rejects linked parent directories before inspecting their children.
func validateLayout(root *os.Root, home string) error {
	for _, dir := range []string{"config", "config/tasks", "data", "logs", "releases"} {
		item, e := root.Lstat(filepath.FromSlash(dir))
		if errors.Is(e, os.ErrNotExist) {
			continue
		}
		if e != nil {
			return e
		}
		if !item.IsDir() || item.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("unsafe installation subdirectory %s", filepath.Join(home, dir))
		}
	}
	return nil
}

// verifyInstallationMarker requires evidence of ownership before cleaning a custom path.
func verifyInstallationMarker(root *os.Root, home string, entries []string) error {
	if hasInstallationEvidence(root, entries) {
		return nil
	}

	// After a successful uninstall, a shared directory can still contain unrelated files.
	for _, entry := range entries {
		if _, err := root.Lstat(filepath.FromSlash(entry)); !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("cannot identify custom PSU-EXT installation at %s", home)
		}
	}
	return nil
}

// confirmUninstall describes the data loss and accepts one exact confirmation line.
func confirmUninstall(input io.Reader, output io.Writer, home string) (bool, error) {
	const prompt = "PSU-EXT installation: %s\n" +
		"Uninstall stops PSU-EXT, interrupts running scripts, and permanently removes the application, configuration, device profiles, scripts, script results, and application logs.\n" +
		"Back up anything you need outside this installation directory before continuing.\n" +
		"Type UNINSTALL and press Enter to continue: "
	_, err := fmt.Fprintf(output, prompt, home)
	if err != nil {
		return false, err
	}

	line, err := bufio.NewReader(input).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return false, err
	}
	if err != nil || strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r") != "UNINSTALL" {
		_, err = fmt.Fprintln(output, "Uninstall cancelled.")
		return false, err
	}
	return true, nil
}

// removeInstallation deletes managed entries before pruning empty parent directories.
func removeInstallation(ctx context.Context, output io.Writer, root *os.Root, home string, entries []string) error {
	for _, entry := range entries {
		path := filepath.Join(home, entry)
		if err := removeWithRetry(ctx, output, path, func() error {
			return root.RemoveAll(filepath.FromSlash(entry))
		}); err != nil {
			return err
		}
	}
	for _, dir := range []string{"config/tasks", "config", "data", "logs", "releases", "."} {
		if err := removeEmptyDirectory(ctx, output, root, home, dir); err != nil {
			return err
		}
	}
	return nil
}

// removeEmptyDirectory preserves directories that still contain user files.
func removeEmptyDirectory(ctx context.Context, output io.Writer, root *os.Root, home, dir string) error {
	items, e := root.Open(filepath.FromSlash(dir))
	if errors.Is(e, os.ErrNotExist) {
		return nil
	}
	if e != nil {
		return e
	}

	_, e = items.ReadDir(1)
	items.Close()
	if e == nil {
		return nil
	}
	if !errors.Is(e, io.EOF) {
		return e
	}

	if dir == "." {
		// Release the directory handle before removing it on Windows.
		root.Close()
		return removeWithRetry(ctx, output, home, func() error { return os.Remove(home) })
	}
	return removeWithRetry(ctx, output, filepath.Join(home, dir), func() error {
		return root.Remove(filepath.FromSlash(dir))
	})
}

// removeWithRetry gives Windows time to release file handles after service shutdown.
func removeWithRetry(ctx context.Context, output io.Writer, path string, remove func() error) error {
	err := remove()
	if err == nil || errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if !isWindowsFileLock(err) {
		return fmt.Errorf("remove %s: %w", path, err)
	}

	fmt.Fprintf(output, "Waiting for Windows to release files in %s...\n", path)
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for isWindowsFileLock(err) {
		select {
		case <-ctx.Done():
			return fmt.Errorf("remove %s: %w. Close programs using these files, then rerun psu-ext uninstall", path, err)
		case <-ticker.C:
			err = remove()
		}
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove %s: %w", path, err)
	}
	return nil
}

// isWindowsFileLock distinguishes sharing conflicts from permission and filesystem errors.
func isWindowsFileLock(err error) bool {
	const (
		sharingViolation = syscall.Errno(32)
		lockViolation    = syscall.Errno(33)
	)
	return runtime.GOOS == "windows" && (errors.Is(err, sharingViolation) || errors.Is(err, lockViolation))
}
