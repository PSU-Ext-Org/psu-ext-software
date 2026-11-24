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
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// TestNativeAgentRemoval loads a uniquely named sleeper in the current GUI session.
func TestNativeAgentRemoval(t *testing.T) {
	if os.Getenv("PSU_EXT_TEST_NATIVE_SERVICES") != "1" {
		t.Skip("set PSU_EXT_TEST_NATIVE_SERVICES=1 to exercise launchd")
	}
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	plist, err := os.CreateTemp(dir, "com.psuext.uninstall-test-*.plist")
	if err != nil {
		t.Fatal(err)
	}
	name := filepath.Base(plist.Name())
	fixture := agent{label: name[:len(name)-len(".plist")], executable: "/bin/sleep", arguments: []string{"60"}, workingDirectory: dir, logPath: filepath.Join(dir, "sleep.log")}
	if _, err := plist.WriteString(renderAgent(fixture)); err != nil {
		t.Fatal(err)
	}
	if err := plist.Close(); err != nil {
		t.Fatal(err)
	}

	// Only the fixture label is booted out if a later assertion fails.
	target := userDomain() + "/" + fixture.label
	if output, err := exec.Command("launchctl", "bootstrap", userDomain(), plist.Name()).CombinedOutput(); err != nil {
		t.Fatalf("bootstrap: %v: %s", err, output)
	}
	t.Cleanup(func() { _ = exec.Command("launchctl", "bootout", target).Run() })
	if output, err := exec.Command("launchctl", "kickstart", target).CombinedOutput(); err != nil {
		t.Fatalf("kickstart: %v: %s", err, output)
	}

	for i := 0; i < 2; i++ {
		if err := removeAgent(context.Background(), io.Discard, dir, dir, fixture); err != nil {
			t.Fatal(err)
		}
	}
}
