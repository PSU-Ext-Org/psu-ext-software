// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package release_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
)

func TestDownloadVerifiedRejectsChecksumMismatchAndHTTPError(t *testing.T) {
	for _, test := range []struct {
		name   string
		status int
	}{
		{name: "checksum mismatch", status: http.StatusOK},
		{name: "HTTP error", status: http.StatusNotFound},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
				response.WriteHeader(test.status)
				_, _ = response.Write([]byte("unexpected"))
			}))
			defer server.Close()
			target := filepath.Join(t.TempDir(), "bundle.zip")
			if err := release.DownloadVerified(context.Background(), server.Client(), server.URL, target, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); err == nil {
				t.Fatal("expected download error")
			}
		})
	}
}

func TestFetchManifest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"version":"1.2.3","assets":{"linux-amd64":{"name":"bundle.tar.gz","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}`))
	}))
	defer server.Close()

	manifest, err := release.FetchManifest(context.Background(), server.Client(), server.URL, "linux-amd64")
	if err != nil {
		t.Fatal(err)
	}
	if manifest.Version != "1.2.3" {
		t.Fatalf("version = %q, want 1.2.3", manifest.Version)
	}
}

func TestFetchManifestRejectsInvalidChecksum(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"version":"1.2.3","assets":{"linux-amd64":{"name":"bundle.tar.gz","sha256":"invalid"}}}`))
	}))
	defer server.Close()

	if _, err := release.FetchManifest(context.Background(), server.Client(), server.URL, "linux-amd64"); err == nil {
		t.Fatal("expected invalid checksum error")
	}
}

func TestFetchManifestSelectsPlatform(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"version":"1.2.3","assets":{"darwin-arm64":{"name":"mac.tar.gz","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}`))
	}))
	defer server.Close()

	manifest, err := release.FetchManifest(context.Background(), server.Client(), server.URL, "darwin-arm64")
	if err != nil {
		t.Fatal(err)
	}
	if manifest.Assets["darwin-arm64"].Name != "mac.tar.gz" {
		t.Fatalf("unexpected assets: %#v", manifest.Assets)
	}
}

func TestFetchManifestRejectsMissingPlatform(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		_, _ = response.Write([]byte(`{"version":"1.2.3","assets":{"linux-amd64":{"name":"linux.tar.gz","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}`))
	}))
	defer server.Close()

	if _, err := release.FetchManifest(context.Background(), server.Client(), server.URL, "darwin-arm64"); err == nil {
		t.Fatal("expected missing platform error")
	}
}
