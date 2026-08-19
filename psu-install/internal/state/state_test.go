// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package state_test

import (
	"path/filepath"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

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
