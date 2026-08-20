// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package installer

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
)

func TestReleaseURLPreservesOverrideAndNormalizesTrailingSlash(t *testing.T) {
	manager := Manager{releaseBaseURL: "http://localhost:8080/releases"}
	if actual := manager.releaseURL("latest", "bundle.zip"); actual != "http://localhost:8080/releases/latest/download/bundle.zip" {
		t.Fatalf("latest URL = %q", actual)
	}
	if actual := manager.releaseURL("v1.2.3", "bundle.zip"); actual != "http://localhost:8080/releases/download/v1.2.3/bundle.zip" {
		t.Fatalf("versioned URL = %q", actual)
	}
	if actual := manager.releaseURL("release-candidate", "bundle.zip"); actual != "http://localhost:8080/releases/download/release-candidate/bundle.zip" {
		t.Fatalf("exact-tag URL = %q", actual)
	}
}

func TestCommandServicesKeepsLegacyAdapterAndSupportsHomeAwareAdapter(t *testing.T) {
	previousPlatform := activePlatform
	t.Cleanup(func() { activePlatform = previousPlatform })

	legacyCalled := false
	activePlatform.services = serviceAdapter{
		command: func(_ context.Context, _ io.Writer, command string) error {
			legacyCalled = command == "status"
			return nil
		},
	}
	if err := commandServices(context.Background(), io.Discard, `C:\ignored`, "status"); err != nil {
		t.Fatal(err)
	}
	if !legacyCalled {
		t.Fatal("legacy service command was not called")
	}

	var receivedHome string
	activePlatform.services.commandWithHome = func(_ context.Context, _ io.Writer, home, _ string) error {
		receivedHome = home
		return nil
	}
	if err := commandServices(context.Background(), io.Discard, `C:\PSU EXT`, "status"); err != nil {
		t.Fatal(err)
	}
	if receivedHome != `C:\PSU EXT` {
		t.Fatalf("home-aware adapter received %q", receivedHome)
	}
}

func TestInstallUsesOverriddenHTTPRootAndVersionedWindowsZip(t *testing.T) {
	bundle := windowsTestBundle(t)
	bundleContent, err := os.ReadFile(bundle)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(bundleContent)
	var requests []string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requests = append(requests, request.URL.Path)
		switch request.URL.Path {
		case "/releases/download/v1.2.3/release-manifest.json":
			_, _ = fmt.Fprintf(response, `{"version":"1.2.3","assets":{"windows-amd64":{"name":"bundle.zip","sha256":"%s"}}}`, hex.EncodeToString(digest[:]))
		case "/releases/download/v1.2.3/bundle.zip":
			_, _ = response.Write(bundleContent)
		default:
			http.NotFound(response, request)
		}
	}))
	defer server.Close()

	home := filepath.Join(t.TempDir(), "PSU EXT home")
	t.Setenv("PSU_EXT_HOME", home)
	t.Setenv("PSU_EXT_RELEASE_BASE_URL", server.URL+"/releases/")
	previousPlatform := activePlatform
	activePlatform = platformAdapter{
		key: "windows-amd64",
		services: serviceAdapter{
			install:         func(string) error { return nil },
			commandWithHome: func(context.Context, io.Writer, string, string) error { return nil },
			logs:            func(context.Context, io.Writer, string, string) error { return nil },
		},
		extract: release.ExtractZip, validate: release.ValidateWindows,
		activate: func(string, string) error { return nil },
	}
	t.Cleanup(func() { activePlatform = previousPlatform })

	manager, err := NewManager()
	if err != nil {
		t.Fatal(err)
	}
	manager.stdout = io.Discard
	if err := manager.Install(context.Background(), "v1.2.3"); err != nil {
		t.Fatal(err)
	}
	wantRequests := []string{
		"/releases/download/v1.2.3/release-manifest.json",
		"/releases/download/v1.2.3/bundle.zip",
	}
	if !reflect.DeepEqual(requests, wantRequests) {
		t.Fatalf("requests = %#v, want %#v", requests, wantRequests)
	}
	if _, err := os.Stat(filepath.Join(home, "releases", "1.2.3", "runtime", "bin", "java.exe")); err != nil {
		t.Fatal(err)
	}
}

func windowsTestBundle(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "bundle.zip")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	for _, name := range []string{
		"runtime/bin/java.exe", "bin/caddy.exe", "apps/psu-be-proxy.jar",
		"apps/psu-be-script-runner.jar", "frontend/index.html",
	} {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(name)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}
