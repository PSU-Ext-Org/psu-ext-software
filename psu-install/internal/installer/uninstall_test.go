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
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestUninstall covers cancellation, service failure, retry, and path protection.
func TestUninstall(t *testing.T) {
	home, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	userHome := t.TempDir()
	t.Setenv("USERPROFILE", userHome)
	t.Setenv("HOME", userHome)
	writeUninstallFixture(t, home)

	original := activePlatform
	t.Cleanup(func() { activePlatform = original })
	calls := 0
	failure := errors.New("service unavailable")
	activePlatform.services.uninstall = func(context.Context, io.Writer, string) error {
		calls++
		return failure
	}
	var output bytes.Buffer
	m := Manager{home: home, platform: "linux-amd64", stdout: &output}
	run := func(input string) error {
		output.Reset()
		return m.Uninstall(context.Background(), strings.NewReader(input))
	}

	t.Run("cancellation", func(t *testing.T) {
		for _, input := range []string{"", "UNINSTALL", "uninstall\n", " UNINSTALL\n", "UNINSTALL \n"} {
			if err := run(input); err != nil || calls != 0 || !strings.Contains(output.String(), home) || !strings.Contains(output.String(), "Back up") {
				t.Fatalf("cancel %q: %s, %v", input, output.String(), err)
			}
		}
	})

	t.Run("service failure preserves data", func(t *testing.T) {
		if err := run("UNINSTALL\n"); !errors.Is(err, failure) || strings.Contains(output.String(), "rm --") {
			t.Fatalf("failure: %v %s", err, output.String())
		}
		if _, err := os.Stat(filepath.Join(home, "data/devices.json")); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("retry preserves unrelated files", func(t *testing.T) {
		failure = nil
		for i := 0; i < 2; i++ {
			if err := run("UNINSTALL\r\n"); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(output.String(), "rm --") {
				t.Fatal(output.String())
			}
			for _, name := range []string{"my-backup", "logs/other.log", "releases/notes.txt", "current/other-project"} {
				if _, err := os.Stat(filepath.Join(home, name)); err != nil {
					t.Fatal(err)
				}
			}
			for _, name := range []string{"install-state.json", "data", "config", "logs/runner.log", "releases/v1"} {
				if _, err := os.Stat(filepath.Join(home, name)); !errors.Is(err, os.ErrNotExist) {
					t.Fatalf("expected %s to be removed, got %v", name, err)
				}
			}
		}
	})

	t.Run("reject user home", func(t *testing.T) {
		m.home = userHome
		if err := run("UNINSTALL\n"); err == nil {
			t.Fatal("accepted user home")
		}
	})

	t.Run("reject unknown installation", func(t *testing.T) {
		m.home = t.TempDir()
		if err := os.Mkdir(filepath.Join(m.home, "logs"), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(m.home, "install-state.json"), []byte("{}"), 0600); err != nil {
			t.Fatal(err)
		}
		if err := run("UNINSTALL\n"); err == nil {
			t.Fatal("accepted unknown custom installation")
		}
	})
}

// writeUninstallFixture creates managed files alongside a backup that must survive.
func writeUninstallFixture(t *testing.T, home string) {
	t.Helper()
	files := []string{
		"install-state.json",
		"data/devices.json",
		"data/script-storage/result",
		"data/script-definitions/script",
		"config/Caddyfile",
		"releases/v1/apps/psu-be-proxy.jar",
		"releases/notes.txt",
		"logs/runner.log",
		"logs/other.log",
		"my-backup",
		"current/other-project",
	}
	for _, name := range files {
		path := filepath.Join(home, name)
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("fixture"), 0600); err != nil {
			t.Fatal(err)
		}
	}
}

// TestManualRemovalQuoting verifies paths containing spaces and apostrophes.
func TestManualRemovalQuoting(t *testing.T) {
	path := "/a b/c'd"
	commands := map[string]string{
		"linux-amd64":   "rm -- '/a b/c'\\''d'",
		"darwin-arm64":  "rm -- '/a b/c'\\''d'",
		"windows-amd64": "Remove-Item -LiteralPath '/a b/c''d'",
	}
	for platform, want := range commands {
		if got := deleteCommand(platform, path); got != want {
			t.Errorf("%s: %s", platform, got)
		}
	}
}

// TestManualRemovalCommand runs the printed command on a disposable executable path.
func TestManualRemovalCommand(t *testing.T) {
	path := filepath.Join(t.TempDir(), "PSU's test [1]", "psu-ext")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, nil, 0700); err != nil {
		t.Fatal(err)
	}

	command := deleteCommand(runtime.GOOS+"-"+runtime.GOARCH, path)
	var shell *exec.Cmd
	if runtime.GOOS == "windows" {
		shell = exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command)
	} else {
		shell = exec.Command("sh", "-c", command)
	}
	if output, err := shell.CombinedOutput(); err != nil {
		t.Fatalf("manual removal: %v: %s", err, output)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected CLI removed, got %v", err)
	}
}
