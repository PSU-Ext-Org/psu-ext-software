// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package taskscheduler

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

func TestRenderTaskCreatesTriggerlessLeastPrivilegeDefinition(t *testing.T) {
	task := taskSpec{
		name: "PSU-EXT Proxy", description: "Proxy & instruments",
		executable:       `C:\Users\Mäx User\.psu-ext\java.exe`,
		arguments:        []string{"-jar", `C:\Users\Mäx User\proxy "test".jar`},
		workingDirectory: `C:\Users\Mäx User\.psu-ext\data`,
	}
	content, err := renderTask(task, "S-1-5-21-1000")
	if err != nil {
		t.Fatal(err)
	}
	definition := string(content)
	for _, expected := range []string{
		`<Triggers></Triggers>`, `<UserId>S-1-5-21-1000</UserId>`,
		`<LogonType>InteractiveToken</LogonType>`, `<RunLevel>LeastPrivilege</RunLevel>`,
		`<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>`,
		`<AllowStartOnDemand>true</AllowStartOnDemand>`, `<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>`,
		`<Interval>PT1M</Interval>`, `<Count>3</Count>`, `Proxy &amp; instruments`, `Mäx User`,
	} {
		if !strings.Contains(definition, expected) {
			t.Fatalf("task XML does not contain %q:\n%s", expected, definition)
		}
	}
	if strings.Contains(definition, "<CalendarTrigger") || strings.Contains(definition, "<LogonTrigger") {
		t.Fatalf("task unexpectedly has a trigger:\n%s", definition)
	}
}

func TestRunCommandIncludesNativeErrorOutput(t *testing.T) {
	if len(os.Args) > 1 && os.Args[len(os.Args)-1] == "taskscheduler-command-helper" {
		_, _ = os.Stderr.WriteString("native scheduler failure\n")
		os.Exit(7)
	}
	err := runCommand(context.Background(), io.Discard, os.Args[0], "-test.run=TestRunCommandIncludesNativeErrorOutput", "taskscheduler-command-helper")
	if err == nil || !strings.Contains(err.Error(), "native scheduler failure") {
		t.Fatalf("error = %v, want native command output", err)
	}
}

func TestEncodeTaskXMLUsesUTF16LEWithMatchingDeclaration(t *testing.T) {
	encoded := encodeTaskXML([]byte(xml.Header + "<Task></Task>"))
	if len(encoded) < 2 || encoded[0] != 0xff || encoded[1] != 0xfe {
		t.Fatalf("task XML lacks UTF-16LE BOM: %x", encoded[:min(len(encoded), 4)])
	}
	codeUnits := make([]uint16, (len(encoded)-2)/2)
	for index := range codeUnits {
		codeUnits[index] = binary.LittleEndian.Uint16(encoded[2+index*2:])
	}
	decoded := string(utf16.Decode(codeUnits))
	if !strings.Contains(decoded, `encoding="UTF-16"`) || strings.Contains(decoded, `encoding="UTF-8"`) {
		t.Fatalf("unexpected task XML declaration: %q", decoded)
	}
}

func TestWindowsArgumentQuoting(t *testing.T) {
	arguments := []string{"plain", "two words", `ends\`, `has"quote`, ""}
	actual := joinWindowsArguments(arguments)
	expected := `plain "two words" ends\ "has\"quote" ""`
	if actual != expected {
		t.Fatalf("arguments = %q, want %q", actual, expected)
	}
}

func TestStartRollsBackAlreadyStartedTasks(t *testing.T) {
	home := writeState(t)
	var calls []string
	runner := func(_ context.Context, _ io.Writer, _ string, arguments ...string) error {
		calls = append(calls, strings.Join(arguments, " "))
		if len(arguments) > 2 && arguments[0] == "/Run" && arguments[2] == runnerTask {
			return errors.New("start failed")
		}
		return nil
	}
	manager := newManager(home)
	manager.run = runner
	manager.ready = func(int) bool { return true }
	if err := manager.command(context.Background(), io.Discard, "start"); err == nil {
		t.Fatal("expected start error")
	}
	if len(calls) != 3 || calls[2] != "/End /TN "+proxyTask {
		t.Fatalf("calls = %#v, want proxy rollback", calls)
	}
}

func TestStartTimesOutAndRollsBackInReverseOrder(t *testing.T) {
	home := writeState(t)
	var calls []string
	manager := newManager(home)
	manager.run = func(_ context.Context, _ io.Writer, _ string, arguments ...string) error {
		calls = append(calls, strings.Join(arguments, " "))
		return nil
	}
	manager.ready = func(int) bool { return false }
	manager.timeout = time.Millisecond
	manager.poll = time.Millisecond
	if err := manager.command(context.Background(), io.Discard, "start"); err == nil {
		t.Fatal("expected readiness timeout")
	}
	joined := strings.Join(calls, "\n")
	for _, expected := range []string{"/End /TN " + caddyTask, "/End /TN " + runnerTask, "/End /TN " + proxyTask} {
		if !strings.Contains(joined, expected) {
			t.Fatalf("calls do not contain %q: %#v", expected, calls)
		}
	}
}

func TestInstallIsIdempotentAndWritesThreeDefinitions(t *testing.T) {
	home := writeState(t)
	var calls []string
	manager := newManager(home)
	manager.currentSID = func() (string, error) { return "S-1-5-21-1000", nil }
	manager.run = func(_ context.Context, _ io.Writer, _ string, arguments ...string) error {
		calls = append(calls, strings.Join(arguments, " "))
		return nil
	}
	for range 2 {
		if err := manager.install(context.Background(), io.Discard); err != nil {
			t.Fatal(err)
		}
	}
	if len(calls) != 6 {
		t.Fatalf("registration calls = %d, want 6", len(calls))
	}
	for _, call := range calls {
		if !strings.Contains(call, "/Create") || !strings.Contains(call, "/F") {
			t.Fatalf("registration is not idempotent: %q", call)
		}
	}
	entries, err := os.ReadDir(filepath.Join(home, "config", "tasks"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 3 {
		t.Fatalf("task definitions = %d, want 3", len(entries))
	}
}

func TestStatusIncludesNativeOutputAndReachability(t *testing.T) {
	home := writeState(t)
	manager := newManager(home)
	manager.run = func(_ context.Context, output io.Writer, _ string, arguments ...string) error {
		_, _ = io.WriteString(output, "native "+strings.Join(arguments, " ")+"\n")
		return nil
	}
	manager.ready = func(port int) bool { return port == 18081 }
	var output bytes.Buffer
	if err := manager.command(context.Background(), &output, "status"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output.String(), "native /Query") || !strings.Contains(output.String(), "127.0.0.1:18081: reachable") {
		t.Fatalf("unexpected status:\n%s", output.String())
	}
}

func writeState(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	if err := os.MkdirAll(filepath.Join(home, "config"), 0700); err != nil {
		t.Fatal(err)
	}
	current := state.State{Version: "1.2.3", CaddyPort: 18080, ProxyPort: 18081, RunnerPort: 18082}
	if err := state.Save(filepath.Join(home, "install-state.json"), current); err != nil {
		t.Fatal(err)
	}
	return home
}
