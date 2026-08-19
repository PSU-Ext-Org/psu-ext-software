// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package state owns the persistent installer state and user-data layout.
package state

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
)

const (
	firstPort = 18080
	lastPort  = 18179
)

// State persists the selected release and local endpoint layout across updates.
type State struct {
	Version    string `json:"version"`
	CaddyPort  int    `json:"caddyPort"`
	ProxyPort  int    `json:"proxyPort"`
	RunnerPort int    `json:"runnerPort"`
}

// Load reads and validates installer state from disk.
func Load(path string) (State, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return State{}, err
	}
	var current State
	if err := json.Unmarshal(data, &current); err != nil {
		return State{}, fmt.Errorf("read install state: %w", err)
	}
	if current.CaddyPort == 0 || current.ProxyPort == 0 || current.RunnerPort == 0 {
		return State{}, fmt.Errorf("install state has incomplete port allocation")
	}
	return current, nil
}

// Save atomically persists installer state.
func Save(path string, current State) error {
	data, err := json.MarshalIndent(current, "", "  ")
	if err != nil {
		return err
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, append(data, '\n'), 0600); err != nil {
		return err
	}
	return os.Rename(temporary, path)
}

// EnsureLayout creates persistent user directories without replacing user data.
func EnsureLayout(home string) error {
	for _, path := range []string{
		filepath.Join(home, "config"),
		filepath.Join(home, "data", "script-definitions"),
		filepath.Join(home, "data", "script-storage"),
		filepath.Join(home, "releases"),
		filepath.Join(home, "logs"),
	} {
		if err := os.MkdirAll(path, 0700); err != nil {
			return err
		}
	}
	devices := filepath.Join(home, "data", "devices.json")
	if _, err := os.Stat(devices); os.IsNotExist(err) {
		return os.WriteFile(devices, []byte("[]\n"), 0600)
	}
	return nil
}

// AllocatePorts chooses three consecutive, free loopback ports.
func AllocatePorts() (State, error) {
	for caddy := firstPort; caddy <= lastPort-2; caddy++ {
		candidate := State{CaddyPort: caddy, ProxyPort: caddy + 1, RunnerPort: caddy + 2}
		if PortsAvailable(candidate) {
			return candidate, nil
		}
	}
	return State{}, fmt.Errorf("no three-port allocation available in %d-%d", firstPort, lastPort)
}

// PortsAvailable reports whether every configured loopback port can be bound.
func PortsAvailable(current State) bool {
	listeners := make([]net.Listener, 0, 3)
	for _, port := range []int{current.CaddyPort, current.ProxyPort, current.RunnerPort} {
		listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			closeListeners(listeners)
			return false
		}
		listeners = append(listeners, listener)
	}
	closeListeners(listeners)
	return true
}

func closeListeners(listeners []net.Listener) {
	for _, listener := range listeners {
		_ = listener.Close()
	}
}
