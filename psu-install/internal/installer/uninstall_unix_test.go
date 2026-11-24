//go:build linux || darwin

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
	"context"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestUnixServiceRemoval exercises the installed definitions with isolated service commands.
func TestUnixServiceRemoval(t *testing.T) {
	user, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	home := filepath.Join(user, ".psu-ext")
	config := filepath.Join(user, ".config")
	t.Setenv("HOME", user)
	t.Setenv("XDG_CONFIG_HOME", config)
	t.Setenv("PATH", user+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("APP_HOME", home)

	command, script := "systemctl", fakeSystemctl
	if runtime.GOOS == "darwin" {
		command, script = "launchctl", fakeLaunchctl
	}
	if err := os.WriteFile(filepath.Join(user, command), []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	if err := installServices(home); err != nil {
		t.Fatal(err)
	}

	remove := func() error { return activePlatform.services.uninstall(context.Background(), io.Discard, home) }
	t.Setenv("FAIL_STOP", "yes")
	if err := remove(); err == nil {
		t.Fatal("expected stop failure")
	}
	t.Setenv("FAIL_STOP", "")
	if err := remove(); err != nil {
		t.Fatal(err)
	}
	if err := remove(); err != nil {
		t.Fatalf("retry: %v", err)
	}

	// A successful uninstall must remove all three native registrations.
	calls, err := os.ReadFile(filepath.Join(user, "removed"))
	if err != nil || len(strings.Fields(string(calls))) != 3 {
		t.Fatalf("removed services: %s (%v)", calls, err)
	}
}

// fakeSystemctl derives registration status from the unit files written by Install.
const fakeSystemctl = `#!/bin/sh
case "$2" in
 show)
   file="$XDG_CONFIG_HOME/systemd/user/$4"
   if [ -f "$file" ]; then printf 'LoadState=loaded\nFragmentPath=%s\n' "$file"; else printf 'LoadState=not-found\nActiveState=inactive\n'; fi ;;
 stop) test -z "$FAIL_STOP" ;;
 disable) echo "$3" >> "$HOME/removed" ;;
 daemon-reload) exit 0 ;;
 *) exit 2 ;;
esac
`

// fakeLaunchctl uses the installed plist and simulates a failed or successful bootout.
const fakeLaunchctl = `#!/bin/sh
label=${2##*/}
case "$1" in
 print)
   if [ ! -f "$HOME/Library/LaunchAgents/$label.plist" ]; then echo "Could not find service" >&2; exit 113; fi
   program=runtime/bin/java
   if [ "$label" = com.psuext.caddy ]; then program=bin/caddy; fi
   echo "program = $APP_HOME/current/$program" ;;
 bootout) test -z "$FAIL_STOP" || exit 1; echo "$label" >> "$HOME/removed" ;;
 *) exit 2 ;;
esac
`
