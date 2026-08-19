// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

//go:build darwin

package launchd

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
)

// Command performs one lifecycle operation for all three launch agents.
func Command(ctx context.Context, output io.Writer, command string) error {
	switch command {
	case "start":
		return start(ctx, output)
	case "stop":
		return stop(ctx, output)
	case "restart":
		if err := stop(ctx, output); err != nil {
			return err
		}
		return start(ctx, output)
	case "status":
		return status(ctx, output)
	default:
		return fmt.Errorf("unsupported service command %q", command)
	}
}

func start(ctx context.Context, output io.Writer) error {
	unitDirectory, err := launchAgentDirectory()
	if err != nil {
		return err
	}
	for _, name := range serviceNames {
		target := serviceTarget(name)
		if !isLoaded(ctx, target) {
			plist := filepath.Join(unitDirectory, label(name)+".plist")
			if err := run(ctx, output, "launchctl", "bootstrap", userDomain(), plist); err != nil {
				return err
			}
		}
		// kickstart starts a loaded-but-idle agent without replacing a running one.
		if err := run(ctx, output, "launchctl", "kickstart", target); err != nil {
			return err
		}
	}
	return nil
}

func stop(ctx context.Context, output io.Writer) error {
	for _, name := range serviceNames {
		target := serviceTarget(name)
		if isLoaded(ctx, target) {
			if err := run(ctx, output, "launchctl", "bootout", target); err != nil {
				return err
			}
		}
	}
	return nil
}

func status(ctx context.Context, output io.Writer) error {
	for _, name := range serviceNames {
		_, _ = fmt.Fprintf(output, "--- %s ---\n", name)
		if err := run(ctx, output, "launchctl", "print", serviceTarget(name)); err != nil {
			_, _ = fmt.Fprintln(output, "not loaded")
		}
	}
	return nil
}

func run(ctx context.Context, output io.Writer, command string, arguments ...string) error {
	cmd := exec.CommandContext(ctx, command, arguments...)
	cmd.Stdout, cmd.Stderr = output, output
	return cmd.Run()
}

func isLoaded(ctx context.Context, target string) bool {
	return exec.CommandContext(ctx, "launchctl", "print", target).Run() == nil
}
