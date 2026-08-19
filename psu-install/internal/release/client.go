// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package release downloads, verifies, and activates versioned application bundles.
package release

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// Manifest identifies the immutable archive published for a release platform.
type Manifest struct {
	Version string                   `json:"version"`
	Assets  map[string]ManifestAsset `json:"assets"`
}

// ManifestAsset is a downloadable release asset with a mandatory SHA-256 digest.
type ManifestAsset struct {
	Name   string `json:"name"`
	SHA256 string `json:"sha256"`
}

// FetchManifest downloads and validates a release manifest.
func FetchManifest(ctx context.Context, client *http.Client, url string) (Manifest, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return Manifest{}, err
	}
	response, err := client.Do(req)
	if err != nil {
		return Manifest{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Manifest{}, fmt.Errorf("download manifest: %s", response.Status)
	}
	var manifest Manifest
	if err := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode manifest: %w", err)
	}
	asset := manifest.Assets["linux-amd64"]
	if manifest.Version == "" || asset.Name == "" {
		return Manifest{}, fmt.Errorf("manifest has no linux-amd64 release asset")
	}
	if _, err := hex.DecodeString(asset.SHA256); err != nil || len(asset.SHA256) != 64 {
		return Manifest{}, fmt.Errorf("manifest has invalid linux-amd64 SHA-256")
	}
	return manifest, nil
}

// DownloadVerified downloads an asset and atomically publishes it after checksum validation.
func DownloadVerified(ctx context.Context, client *http.Client, url, target, expectedSHA256 string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	response, err := client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("download bundle: %s", response.Status)
	}
	temporary := target + ".partial"
	file, err := os.OpenFile(temporary, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, copyErr := io.Copy(io.MultiWriter(file, hash), response.Body)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if actual := hex.EncodeToString(hash.Sum(nil)); actual != expectedSHA256 {
		_ = os.Remove(temporary)
		return fmt.Errorf("bundle checksum mismatch")
	}
	return os.Rename(temporary, target)
}
