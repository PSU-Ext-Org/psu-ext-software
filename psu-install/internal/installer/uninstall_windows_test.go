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
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

// TestUninstallRetriesLockedRelease exercises a real Windows sharing violation.
func TestUninstallRetriesLockedRelease(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "releases")
	if err := os.Mkdir(dir, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "app.exe")
	if err := os.WriteFile(path, nil, 0600); err != nil {
		t.Fatal(err)
	}

	release := lockAgainstDeletion(t, path)
	root, err := os.OpenRoot(home)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()

	var output bytes.Buffer
	var initialError error
	attempts := 0
	err = removeWithRetry(context.Background(), &output, dir, func() error {
		attempts++
		err := root.RemoveAll("releases")
		if attempts == 1 {
			initialError = err
			release()
		}
		return err
	})
	if !errors.Is(initialError, syscall.Errno(32)) {
		t.Fatalf("expected a sharing violation, got %v", initialError)
	}
	if err != nil || attempts != 2 {
		t.Fatalf("expected removal to succeed on retry, got %d attempts and %v", attempts, err)
	}
	if !strings.Contains(output.String(), "Waiting for Windows") {
		t.Fatalf("expected a progress message, got %q", output.String())
	}
}

// lockAgainstDeletion opens a Windows file without granting delete sharing.
func lockAgainstDeletion(t *testing.T, path string) func() {
	t.Helper()
	name, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		t.Fatal(err)
	}
	handle, err := syscall.CreateFile(name, syscall.GENERIC_READ, syscall.FILE_SHARE_READ, nil, syscall.OPEN_EXISTING, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	release := func() {
		if handle != syscall.InvalidHandle {
			if err := syscall.CloseHandle(handle); err != nil {
				t.Error(err)
			}
			handle = syscall.InvalidHandle
		}
	}
	t.Cleanup(release)
	return release
}
