// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package release_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
)

func TestFetchManifest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"version":"1.2.3","assets":{"linux-amd64":{"name":"bundle.tar.gz","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}}`))
	}))
	defer server.Close()

	manifest, err := release.FetchManifest(context.Background(), server.Client(), server.URL)
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

	if _, err := release.FetchManifest(context.Background(), server.Client(), server.URL); err == nil {
		t.Fatal("expected invalid checksum error")
	}
}
