// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package taskscheduler installs and controls per-user PSU-EXT scheduled tasks.
package taskscheduler

import (
	"context"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/logtail"
	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

const (
	proxyTask  = "PSU-EXT Proxy"
	runnerTask = "PSU-EXT Runner"
	caddyTask  = "PSU-EXT Caddy"
)

type taskSpec struct {
	name             string
	description      string
	executable       string
	arguments        []string
	workingDirectory string
	port             int
	logPath          string
}

type commandRunner func(context.Context, io.Writer, string, ...string) error
type readinessCheck func(int) bool

type manager struct {
	home       string
	run        commandRunner
	ready      readinessCheck
	timeout    time.Duration
	poll       time.Duration
	currentSID func() (string, error)
}

// Install writes and registers all three triggerless per-user tasks.
func Install(home string) error {
	return newManager(home).install(context.Background(), io.Discard)
}

// Command invokes a lifecycle operation for the complete Windows task set.
func Command(ctx context.Context, output io.Writer, home, command string) error {
	return newManager(home).command(ctx, output, command)
}

// Logs follows one or all Windows service log files.
func Logs(ctx context.Context, output io.Writer, home, service string) error {
	paths := map[string]string{
		"proxy":  filepath.Join(home, "logs", "proxy.log"),
		"runner": filepath.Join(home, "logs", "runner.log"),
		"caddy":  filepath.Join(home, "logs", "caddy.log"),
	}
	if service != "" {
		path, ok := paths[service]
		if !ok {
			return fmt.Errorf("unknown service %q", service)
		}
		return logtail.Follow(ctx, output, map[string]string{service: path}, 20)
	}
	return logtail.Follow(ctx, output, paths, 20)
}

func newManager(home string) manager {
	return manager{
		home:       home,
		run:        runCommand,
		ready:      portReady,
		timeout:    60 * time.Second,
		poll:       250 * time.Millisecond,
		currentSID: currentUserSID,
	}
}

func (m manager) install(ctx context.Context, output io.Writer) error {
	tasks, err := taskSpecs(m.home)
	if err != nil {
		return err
	}
	sid, err := m.currentSID()
	if err != nil {
		return fmt.Errorf("resolve current Windows user: %w", err)
	}
	directory := filepath.Join(m.home, "config", "tasks")
	if err := os.MkdirAll(directory, 0700); err != nil {
		return err
	}
	for _, task := range tasks {
		content, err := renderTask(task, sid)
		if err != nil {
			return err
		}
		path := filepath.Join(directory, taskFileName(task.name)+".xml")
		if err := os.WriteFile(path, encodeTaskXML(content), 0600); err != nil {
			return err
		}
		if err := m.run(ctx, output, "schtasks.exe", "/Create", "/TN", task.name, "/XML", path, "/F"); err != nil {
			return fmt.Errorf("register %s: %w", task.name, err)
		}
	}
	return nil
}

func encodeTaskXML(content []byte) []byte {
	text := strings.Replace(string(content), `encoding="UTF-8"`, `encoding="UTF-16"`, 1)
	codeUnits := utf16.Encode([]rune(text))
	encoded := make([]byte, 2+len(codeUnits)*2)
	encoded[0], encoded[1] = 0xff, 0xfe
	for index, codeUnit := range codeUnits {
		binary.LittleEndian.PutUint16(encoded[2+index*2:], codeUnit)
	}
	return encoded
}

func (m manager) command(ctx context.Context, output io.Writer, command string) error {
	tasks, err := taskSpecs(m.home)
	if err != nil {
		return err
	}
	switch command {
	case "start":
		return m.start(ctx, output, tasks)
	case "stop":
		return m.stop(ctx, output, tasks)
	case "restart":
		if err := m.stop(ctx, output, tasks); err != nil {
			return err
		}
		return m.start(ctx, output, tasks)
	case "status":
		return m.status(ctx, output, tasks)
	default:
		return fmt.Errorf("unsupported service command %q", command)
	}
}

func (m manager) start(ctx context.Context, output io.Writer, tasks []taskSpec) error {
	started := make([]taskSpec, 0, len(tasks))
	for _, task := range tasks {
		if err := m.run(ctx, output, "schtasks.exe", "/Run", "/TN", task.name); err != nil {
			m.rollback(ctx, output, started)
			return fmt.Errorf("start %s: %w", task.name, err)
		}
		started = append(started, task)
	}
	deadline := time.Now().Add(m.timeout)
	for _, task := range tasks {
		for !m.ready(task.port) {
			if err := ctx.Err(); err != nil {
				m.rollback(ctx, output, started)
				return err
			}
			if time.Now().After(deadline) {
				m.rollback(ctx, output, started)
				return fmt.Errorf("%s did not become ready on port %d within %s", task.name, task.port, m.timeout)
			}
			time.Sleep(m.poll)
		}
	}
	return nil
}

func (m manager) stop(ctx context.Context, output io.Writer, tasks []taskSpec) error {
	var failures []error
	for index := len(tasks) - 1; index >= 0; index-- {
		task := tasks[index]
		if err := m.run(ctx, output, "schtasks.exe", "/End", "/TN", task.name); err != nil {
			failures = append(failures, fmt.Errorf("stop %s: %w", task.name, err))
		}
	}
	if len(failures) == 0 {
		_, _ = fmt.Fprintln(output, "Stopped PSU-EXT. Active script tasks, if any, were interrupted.")
	}
	return errors.Join(failures...)
}

func (m manager) status(ctx context.Context, output io.Writer, tasks []taskSpec) error {
	var failures []error
	for _, task := range tasks {
		_, _ = fmt.Fprintf(output, "--- %s ---\n", task.name)
		if err := m.run(ctx, output, "schtasks.exe", "/Query", "/TN", task.name, "/FO", "LIST", "/V"); err != nil {
			failures = append(failures, fmt.Errorf("query %s: %w", task.name, err))
		}
		state := "unreachable"
		if m.ready(task.port) {
			state = "reachable"
		}
		_, _ = fmt.Fprintf(output, "PSU-EXT endpoint 127.0.0.1:%d: %s\n", task.port, state)
	}
	return errors.Join(failures...)
}

func (m manager) rollback(ctx context.Context, output io.Writer, tasks []taskSpec) {
	for index := len(tasks) - 1; index >= 0; index-- {
		_ = m.run(ctx, output, "schtasks.exe", "/End", "/TN", tasks[index].name)
	}
}

func taskSpecs(home string) ([]taskSpec, error) {
	current, err := state.Load(filepath.Join(home, "install-state.json"))
	if err != nil {
		return nil, fmt.Errorf("load installation state: %w", err)
	}
	release := filepath.Join(home, "releases", current.Version)
	config := filepath.Join(home, "config")
	data := filepath.Join(home, "data")
	logs := filepath.Join(home, "logs")
	java := filepath.Join(release, "runtime", "bin", "java.exe")
	javaArguments := func(jar, override, log string) []string {
		return []string{
			"-jar", filepath.Join(release, "apps", jar),
			"--spring.config.additional-location=file:" + filepath.Join(config, override),
			"--logging.file.name=" + filepath.Join(logs, log),
			"--logging.logback.rollingpolicy.max-file-size=10MB",
			"--logging.logback.rollingpolicy.max-history=5",
			"--logging.logback.rollingpolicy.total-size-cap=50MB",
		}
	}
	return []taskSpec{
		{name: proxyTask, description: "PSU-EXT WebSocket-to-SCPI proxy", executable: java, arguments: javaArguments("psu-be-proxy.jar", "proxy.yaml", "proxy.log"), workingDirectory: data, port: current.ProxyPort, logPath: filepath.Join(logs, "proxy.log")},
		{name: runnerTask, description: "PSU-EXT script runner", executable: java, arguments: javaArguments("psu-be-script-runner.jar", "runner.yaml", "runner.log"), workingDirectory: data, port: current.RunnerPort, logPath: filepath.Join(logs, "runner.log")},
		{name: caddyTask, description: "PSU-EXT local frontend", executable: filepath.Join(release, "bin", "caddy.exe"), arguments: []string{"run", "--config", filepath.Join(config, "Caddyfile"), "--adapter", "caddyfile"}, workingDirectory: home, port: current.CaddyPort, logPath: filepath.Join(logs, "caddy.log")},
	}, nil
}

func runCommand(ctx context.Context, output io.Writer, command string, arguments ...string) error {
	cmd := exec.CommandContext(ctx, command, arguments...)
	result, err := cmd.CombinedOutput()
	if len(result) > 0 {
		if _, writeErr := output.Write(result); writeErr != nil && err == nil {
			return writeErr
		}
	}
	if err == nil {
		return nil
	}
	details := strings.TrimSpace(string(result))
	if details == "" {
		return err
	}
	return fmt.Errorf("%w: %s", err, details)
}

func portReady(port int) bool {
	connection, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 200*time.Millisecond)
	if err != nil {
		return false
	}
	_ = connection.Close()
	return true
}

func currentUserSID() (string, error) {
	current, err := user.Current()
	if err != nil {
		return "", err
	}
	if current.Uid == "" {
		return "", fmt.Errorf("current user has no SID")
	}
	return current.Uid, nil
}

func taskFileName(name string) string {
	return strings.ToLower(strings.ReplaceAll(name, " ", "-"))
}

type taskDocument struct {
	XMLName          xml.Name         `xml:"Task"`
	Xmlns            string           `xml:"xmlns,attr"`
	Version          string           `xml:"version,attr"`
	RegistrationInfo registrationInfo `xml:"RegistrationInfo"`
	Triggers         struct{}         `xml:"Triggers"`
	Principals       principals       `xml:"Principals"`
	Settings         taskSettings     `xml:"Settings"`
	Actions          actions          `xml:"Actions"`
}

type registrationInfo struct {
	Author      string `xml:"Author"`
	Description string `xml:"Description"`
}

type principals struct {
	Principal principal `xml:"Principal"`
}

type principal struct {
	ID        string `xml:"id,attr"`
	UserID    string `xml:"UserId"`
	LogonType string `xml:"LogonType"`
	RunLevel  string `xml:"RunLevel"`
}

type taskSettings struct {
	MultipleInstancesPolicy    string           `xml:"MultipleInstancesPolicy"`
	DisallowStartIfOnBatteries bool             `xml:"DisallowStartIfOnBatteries"`
	StopIfGoingOnBatteries     bool             `xml:"StopIfGoingOnBatteries"`
	AllowHardTerminate         bool             `xml:"AllowHardTerminate"`
	StartWhenAvailable         bool             `xml:"StartWhenAvailable"`
	RunOnlyIfNetworkAvailable  bool             `xml:"RunOnlyIfNetworkAvailable"`
	AllowStartOnDemand         bool             `xml:"AllowStartOnDemand"`
	Enabled                    bool             `xml:"Enabled"`
	ExecutionTimeLimit         string           `xml:"ExecutionTimeLimit"`
	Priority                   int              `xml:"Priority"`
	RestartOnFailure           restartOnFailure `xml:"RestartOnFailure"`
}

type restartOnFailure struct {
	Interval string `xml:"Interval"`
	Count    int    `xml:"Count"`
}

type actions struct {
	Context string     `xml:"Context,attr"`
	Exec    execAction `xml:"Exec"`
}

type execAction struct {
	Command          string `xml:"Command"`
	Arguments        string `xml:"Arguments,omitempty"`
	WorkingDirectory string `xml:"WorkingDirectory"`
}

func renderTask(task taskSpec, sid string) ([]byte, error) {
	document := taskDocument{
		Xmlns:   "http://schemas.microsoft.com/windows/2004/02/mit/task",
		Version: "1.4",
		RegistrationInfo: registrationInfo{
			Author:      "PSU-EXT",
			Description: task.description,
		},
		Principals: principals{Principal: principal{
			ID: "Author", UserID: sid, LogonType: "InteractiveToken", RunLevel: "LeastPrivilege",
		}},
		Settings: taskSettings{
			MultipleInstancesPolicy: "IgnoreNew", DisallowStartIfOnBatteries: false,
			StopIfGoingOnBatteries: false, AllowHardTerminate: true, StartWhenAvailable: false,
			RunOnlyIfNetworkAvailable: false, AllowStartOnDemand: true, Enabled: true,
			ExecutionTimeLimit: "PT0S", Priority: 7,
			RestartOnFailure: restartOnFailure{Interval: "PT1M", Count: 3},
		},
		Actions: actions{Context: "Author", Exec: execAction{
			Command: task.executable, Arguments: joinWindowsArguments(task.arguments), WorkingDirectory: task.workingDirectory,
		}},
	}
	content, err := xml.MarshalIndent(document, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), append(content, '\n')...), nil
}

func joinWindowsArguments(arguments []string) string {
	quoted := make([]string, len(arguments))
	for index, argument := range arguments {
		quoted[index] = quoteWindowsArgument(argument)
	}
	return strings.Join(quoted, " ")
}

func quoteWindowsArgument(argument string) string {
	if argument != "" && !strings.ContainsAny(argument, " \t\n\v\"") {
		return argument
	}
	var result strings.Builder
	result.WriteByte('"')
	backslashes := 0
	for _, character := range argument {
		if character == '\\' {
			backslashes++
			continue
		}
		if character == '"' {
			result.WriteString(strings.Repeat("\\", backslashes*2+1))
			result.WriteRune(character)
			backslashes = 0
			continue
		}
		result.WriteString(strings.Repeat("\\", backslashes))
		backslashes = 0
		result.WriteRune(character)
	}
	result.WriteString(strings.Repeat("\\", backslashes*2))
	result.WriteByte('"')
	return result.String()
}
