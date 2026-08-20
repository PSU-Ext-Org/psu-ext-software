// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package release

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// ExtractZip safely extracts a ZIP release archive into a new directory.
func ExtractZip(archive, destination string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer reader.Close()
	if err := os.MkdirAll(destination, 0700); err != nil {
		return err
	}
	seen := make(map[string]struct{}, len(reader.File))
	for _, entry := range reader.File {
		cleanName, target, err := safeZipTarget(entry.Name, destination)
		if err != nil {
			return err
		}
		if cleanName == "." && entry.FileInfo().IsDir() {
			continue
		}
		key := strings.ToLower(filepath.Clean(cleanName))
		if _, exists := seen[key]; exists {
			return fmt.Errorf("archive contains duplicate entry %q", entry.Name)
		}
		seen[key] = struct{}{}
		mode := entry.Mode()
		if mode&os.ModeSymlink != 0 || (!mode.IsRegular() && !mode.IsDir()) {
			return fmt.Errorf("archive contains unsupported entry %q", entry.Name)
		}
		if mode.IsDir() {
			if err := os.MkdirAll(target, 0700); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return err
		}
		input, err := entry.Open()
		if err != nil {
			return err
		}
		output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			input.Close()
			return err
		}
		_, copyErr := io.Copy(output, input)
		closeOutputErr := output.Close()
		closeInputErr := input.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeOutputErr != nil {
			return closeOutputErr
		}
		if closeInputErr != nil {
			return closeInputErr
		}
	}
	return nil
}

// ValidateWindows checks the minimum Windows executable release contract.
func ValidateWindows(directory string) error {
	for _, relative := range []string{"runtime/bin/java.exe", "bin/caddy.exe", "apps/psu-be-proxy.jar", "apps/psu-be-script-runner.jar", "frontend/index.html"} {
		if _, err := os.Stat(filepath.Join(directory, filepath.FromSlash(relative))); err != nil {
			return fmt.Errorf("invalid release bundle: missing %s", relative)
		}
	}
	return nil
}

func safeZipTarget(name, destination string) (string, string, error) {
	if name == "" || strings.ContainsRune(name, '\x00') || strings.HasPrefix(name, "/") || strings.HasPrefix(name, "\\") {
		return "", "", fmt.Errorf("archive contains unsafe path %q", name)
	}
	normalized := strings.ReplaceAll(name, "\\", "/")
	if len(normalized) >= 2 && normalized[1] == ':' {
		return "", "", fmt.Errorf("archive contains unsafe path %q", name)
	}
	cleanSlash := filepath.ToSlash(filepath.Clean(filepath.FromSlash(normalized)))
	if cleanSlash == ".." || strings.HasPrefix(cleanSlash, "../") || filepath.IsAbs(filepath.FromSlash(cleanSlash)) {
		return "", "", fmt.Errorf("archive contains unsafe path %q", name)
	}
	cleanDestination := filepath.Clean(destination)
	target := filepath.Join(cleanDestination, filepath.FromSlash(cleanSlash))
	relative, err := filepath.Rel(cleanDestination, target)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return "", "", fmt.Errorf("archive contains unsafe path %q", name)
	}
	return filepath.FromSlash(cleanSlash), target, nil
}
