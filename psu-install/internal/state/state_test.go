// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package state_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

func TestEnsureLayoutCreatesDefaultDeviceAndPreservesUserDevices(t *testing.T) {
	home := t.TempDir()
	if err := state.EnsureLayout(home); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(home, "data", "devices.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var devices []struct {
		ID       int    `json:"id"`
		Name     string `json:"name"`
		Type     string `json:"type"`
		Port     string `json:"port"`
		Baudrate int    `json:"baudrate"`
	}
	if err := json.Unmarshal(data, &devices); err != nil {
		t.Fatal(err)
	}
	if len(devices) != 1 {
		t.Fatalf("devices = %s, want one default device", data)
	}
	device := devices[0]
	if device.ID != 0 || device.Name != "PSUEXT1" || device.Type != "USB" || device.Port != "COM5" || device.Baudrate != 9600 {
		t.Fatalf("unexpected default device: %s", data)
	}
	custom := []byte("[]\n")
	if err := os.WriteFile(path, custom, 0600); err != nil {
		t.Fatal(err)
	}
	if err := state.EnsureLayout(home); err != nil {
		t.Fatal(err)
	}
	data, err = os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != string(custom) {
		t.Fatalf("existing devices overwritten: %s", data)
	}
}

func TestStateRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "install-state.json")
	expected := state.State{Version: "1.2.3", CaddyPort: 18080, ProxyPort: 18081, RunnerPort: 18082}
	if err := state.Save(path, expected); err != nil {
		t.Fatal(err)
	}
	actual, err := state.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if actual != expected {
		t.Fatalf("state = %#v, want %#v", actual, expected)
	}
}

func TestAllocatePortsReturnsDistinctUsablePorts(t *testing.T) {
	current, err := state.AllocatePorts()
	if err != nil {
		t.Fatal(err)
	}
	if current.CaddyPort == current.ProxyPort || current.ProxyPort == current.RunnerPort {
		t.Fatalf("ports must be distinct: %#v", current)
	}
	if !state.PortsAvailable(current) {
		t.Fatalf("allocated ports must still be available: %#v", current)
	}
}
