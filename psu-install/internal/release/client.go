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
	"time"
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
func FetchManifest(ctx context.Context, client *http.Client, url, platform string) (Manifest, error) {
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
	asset := manifest.Assets[platform]
	if manifest.Version == "" || asset.Name == "" {
		return Manifest{}, fmt.Errorf("manifest has no %s release asset", platform)
	}
	if _, err := hex.DecodeString(asset.SHA256); err != nil || len(asset.SHA256) != 64 {
		return Manifest{}, fmt.Errorf("manifest has invalid %s SHA-256", platform)
	}
	return manifest, nil
}

// DownloadVerified downloads an asset and atomically publishes it after checksum validation.
func DownloadVerified(ctx context.Context, client *http.Client, url, target, expectedSHA256 string, output io.Writer) error {
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
	progress := downloadProgress{output: output, total: response.ContentLength, nextReport: time.Now().Add(time.Second)}
	_, copyErr := io.Copy(io.MultiWriter(file, hash, &progress), response.Body)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	progress.report()
	fmt.Fprintln(output, "Verifying bundle checksum...")
	if actual := hex.EncodeToString(hash.Sum(nil)); actual != expectedSHA256 {
		_ = os.Remove(temporary)
		return fmt.Errorf("bundle checksum mismatch")
	}
	return os.Rename(temporary, target)
}

// downloadProgress counts bytes written and reports at most once per second during transfer.
type downloadProgress struct {
	output     io.Writer
	total      int64
	received   int64
	lastReport int64
	nextReport time.Time
}

// Write records downloaded bytes after they have been written to the file and hash.
func (p *downloadProgress) Write(data []byte) (int, error) {
	p.received += int64(len(data))
	if now := time.Now(); !now.Before(p.nextReport) {
		p.report()
		p.nextReport = now.Add(time.Second)
	}
	return len(data), nil
}

// report uses a percentage when the server supplies a length and a byte count otherwise.
func (p *downloadProgress) report() {
	if p.lastReport == p.received && p.received != 0 {
		return
	}
	const mib = 1024 * 1024
	if p.total > 0 {
		fmt.Fprintf(p.output, "Downloaded %.2f / %.2f MiB (%.1f%%)\n",
			float64(p.received)/mib, float64(p.total)/mib, 100*float64(p.received)/float64(p.total))
	} else {
		fmt.Fprintf(p.output, "Downloaded %.2f MiB (%d bytes)\n", float64(p.received)/mib, p.received)
	}
	p.lastReport = p.received
}
