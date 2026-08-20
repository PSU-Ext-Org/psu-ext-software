// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package logtail

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestFollowWritesTailAndAppendedContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "proxy.log")
	if err := os.WriteFile(path, []byte("one\ntwo\nthree\n"), 0600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var output safeBuffer
	done := make(chan error, 1)
	go func() { done <- Follow(ctx, &output, map[string]string{"proxy": path}, 2) }()
	waitFor(t, func() bool { return strings.Contains(output.String(), "two\nthree\n") })
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.WriteString("four\n")
	_ = file.Close()
	waitFor(t, func() bool { return strings.Contains(output.String(), "four\n") })
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("follow did not stop after cancellation")
	}
}

func TestFollowReopensRotatedFile(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "runner.log")
	if err := os.WriteFile(path, []byte("before\n"), 0600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var output safeBuffer
	done := make(chan error, 1)
	go func() { done <- Follow(ctx, &output, map[string]string{"runner": path}, 20) }()
	waitFor(t, func() bool { return strings.Contains(output.String(), "before\n") })
	if err := os.Rename(path, path+".1"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("after\n"), 0600); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return strings.Contains(output.String(), "after\n") })
	cancel()
	<-done
}

type safeBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (buffer *safeBuffer) Write(content []byte) (int, error) {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	return buffer.b.Write(content)
}

func (buffer *safeBuffer) String() string {
	buffer.mu.Lock()
	defer buffer.mu.Unlock()
	return buffer.b.String()
}

func waitFor(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !condition() {
		if time.Now().After(deadline) {
			t.Fatal("condition was not satisfied")
		}
		time.Sleep(20 * time.Millisecond)
	}
}
