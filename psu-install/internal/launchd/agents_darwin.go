// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build darwin

package launchd

import (
	"os"
	"path/filepath"
	"strconv"
)

var serviceNames = []string{"proxy", "runner", "caddy"}

func agents(home string) []agent {
	current := filepath.Join(home, "current")
	config := filepath.Join(home, "config")
	data := filepath.Join(home, "data")
	java := filepath.Join(current, "runtime", "bin", "java")
	return []agent{
		{label: label("proxy"), executable: java, arguments: javaArguments(current, config, "psu-be-proxy.jar", "proxy.yaml"), workingDirectory: data, logPath: filepath.Join(home, "logs", "proxy.log")},
		{label: label("runner"), executable: java, arguments: javaArguments(current, config, "psu-be-script-runner.jar", "runner.yaml"), workingDirectory: data, logPath: filepath.Join(home, "logs", "runner.log")},
		{label: label("caddy"), executable: filepath.Join(current, "bin", "caddy"), arguments: []string{"run", "--config", filepath.Join(config, "Caddyfile"), "--adapter", "caddyfile"}, workingDirectory: home, logPath: filepath.Join(home, "logs", "caddy.log")},
	}
}

func javaArguments(current, config, jar, override string) []string {
	return []string{
		"-jar",
		filepath.Join(current, "apps", jar),
		"--spring.config.additional-location=file:" + filepath.Join(config, override),
	}
}

func launchAgentDirectory() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "LaunchAgents"), nil
}

func userDomain() string               { return "gui/" + strconv.Itoa(os.Getuid()) }
func label(name string) string         { return "com.psuext." + name }
func serviceTarget(name string) string { return userDomain() + "/" + label(name) }

func knownService(name string) bool {
	return name == "proxy" || name == "runner" || name == "caddy"
}
