// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package installer orchestrates installation and lifecycle operations.
package installer

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/appconfig"
	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

const defaultReleaseBaseURL = "https://github.com/PSU-Ext-Org/psu-ext-software/releases"

// Manager owns one end-user PSU-EXT installation.
type Manager struct {
	home           string
	platform       string
	releaseBaseURL string
	client         *http.Client
	stdout         io.Writer
}

// NewManager creates a manager for the current user's installation. PSU_EXT_HOME
// and PSU_EXT_RELEASE_BASE_URL are test and enterprise deployment overrides.
func NewManager() (*Manager, error) {
	platform, err := releasePlatform()
	if err != nil {
		return nil, err
	}
	installHome, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	if override := os.Getenv("PSU_EXT_HOME"); override != "" {
		installHome = override
	} else {
		installHome = filepath.Join(installHome, ".psu-ext")
	}
	baseURL := os.Getenv("PSU_EXT_RELEASE_BASE_URL")
	if baseURL == "" {
		baseURL = defaultReleaseBaseURL
	}
	return &Manager{
		home:           installHome,
		platform:       platform,
		releaseBaseURL: strings.TrimRight(baseURL, "/"),
		client:         &http.Client{Timeout: 10 * time.Minute},
		stdout:         os.Stdout,
	}, nil
}

// Install downloads a release, retains user data, and registers services without starting them.
func (m *Manager) Install(ctx context.Context, version string) error {
	if err := state.EnsureLayout(m.home); err != nil {
		return fmt.Errorf("create installation layout: %w", err)
	}
	statePath := filepath.Join(m.home, "install-state.json")
	current, err := loadOrCreateState(statePath)
	if err != nil {
		return err
	}
	tag := version
	if tag == "" {
		tag = "latest"
	}
	fmt.Fprintf(m.stdout, "Checking the %s release for %s...\n", tag, m.platform)
	manifest, err := release.FetchManifest(ctx, m.client, m.releaseURL(tag, "release-manifest.json"), m.platform)
	if err != nil {
		return err
	}
	releaseDir, err := m.downloadRelease(ctx, tag, manifest)
	if err != nil {
		return err
	}
	current.Version = manifest.Version
	fmt.Fprintf(m.stdout, "Writing installation state and configuration in %s...\n", m.home)
	if err := state.Save(statePath, current); err != nil {
		return err
	}
	if err := appconfig.Write(m.home, releaseDir, current); err != nil {
		return err
	}
	fmt.Fprintf(m.stdout, "Activating PSU-EXT %s...\n", manifest.Version)
	if err := activateRelease(m.home, releaseDir); err != nil {
		return err
	}
	fmt.Fprintln(m.stdout, "Registering PSU-EXT services...")
	if err := installServices(m.home); err != nil {
		return err
	}
	fmt.Fprintf(m.stdout, "Installed PSU-EXT %s. Run 'psu-ext start' to launch it.\n", manifest.Version)
	return nil
}

// ServiceCommand invokes the complete platform service set.
func (m *Manager) ServiceCommand(ctx context.Context, command string) error {
	current, err := state.Load(filepath.Join(m.home, "install-state.json"))
	if err != nil {
		return fmt.Errorf("PSU-EXT is not installed: %w", err)
	}
	if err := commandServices(ctx, m.stdout, m.home, command); err != nil {
		return err
	}
	if command == "start" {
		fmt.Fprintf(m.stdout, "PSU-EXT is running at http://localhost:%d\n", current.CaddyPort)
	}
	return nil
}

// Logs streams entries for one service or for the complete stack.
func (m *Manager) Logs(ctx context.Context, service string) error {
	return serviceLogs(ctx, m.stdout, m.home, service)
}

func loadOrCreateState(path string) (state.State, error) {
	current, err := state.Load(path)
	if os.IsNotExist(err) {
		return state.AllocatePorts()
	}
	return current, err
}

// downloadRelease prepares a new bundle or validates an existing version on disk.
func (m *Manager) downloadRelease(ctx context.Context, tag string, manifest release.Manifest) (string, error) {
	asset := manifest.Assets[m.platform]
	releaseDir := filepath.Join(m.home, "releases", manifest.Version)
	if _, err := os.Stat(releaseDir); os.IsNotExist(err) {
		archive := filepath.Join(m.home, "releases", asset.Name)
		fmt.Fprintf(m.stdout, "Downloading PSU-EXT %s (%s)...\n", manifest.Version, asset.Name)
		if err := release.DownloadVerified(ctx, m.client, m.releaseURL(tag, asset.Name), archive, asset.SHA256, m.stdout); err != nil {
			return "", err
		}
		fmt.Fprintln(m.stdout, "Extracting application bundle...")
		if err := extractRelease(archive, releaseDir); err != nil {
			return "", err
		}
		_ = os.Remove(archive)
	} else if err != nil {
		return "", err
	} else {
		fmt.Fprintf(m.stdout, "Using existing bundle for PSU-EXT %s...\n", manifest.Version)
	}
	fmt.Fprintln(m.stdout, "Checking extracted application files...")
	if err := validateRelease(releaseDir); err != nil {
		return "", err
	}
	return releaseDir, nil
}

func (m *Manager) releaseURL(tag, asset string) string {
	if tag == "latest" {
		return fmt.Sprintf("%s/latest/download/%s", m.releaseBaseURL, asset)
	}
	return fmt.Sprintf("%s/download/%s/%s", m.releaseBaseURL, tag, asset)
}
