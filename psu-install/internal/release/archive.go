// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package release

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// ExtractTarGz safely extracts a release archive into a new directory.
func ExtractTarGz(archive, destination string) error {
	file, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer file.Close()
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gzipReader.Close()
	if err := os.MkdirAll(destination, 0700); err != nil {
		return err
	}
	reader := tar.NewReader(gzipReader)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if err := extractEntry(reader, header, destination); err != nil {
			return err
		}
	}
}

// Validate checks the minimum executable release contract.
func Validate(directory string) error {
	for _, relative := range []string{"runtime/bin/java", "bin/caddy", "apps/psu-be-proxy.jar", "apps/psu-be-script-runner.jar", "frontend/index.html"} {
		if _, err := os.Stat(filepath.Join(directory, relative)); err != nil {
			return fmt.Errorf("invalid release bundle: missing %s", relative)
		}
	}
	return nil
}

// Activate atomically switches the current symlink to a release directory.
func Activate(home, directory string) error {
	current := filepath.Join(home, "current")
	temporary := current + ".new"
	_ = os.Remove(temporary)
	if err := os.Symlink(directory, temporary); err != nil {
		return err
	}
	return os.Rename(temporary, current)
}

func extractEntry(reader io.Reader, header *tar.Header, destination string) error {
	cleanName := filepath.Clean(header.Name)
	cleanDestination := filepath.Clean(destination)
	if cleanName == "." && header.Typeflag == tar.TypeDir {
		return nil
	}
	if filepath.IsAbs(cleanName) || cleanName == ".." ||
		strings.HasPrefix(cleanName, ".."+string(os.PathSeparator)) {
		return fmt.Errorf("archive contains unsafe path %q", header.Name)
	}
	target := filepath.Join(cleanDestination, cleanName)
	relative, err := filepath.Rel(cleanDestination, target)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
		return fmt.Errorf("archive contains unsafe path %q", header.Name)
	}
	switch header.Typeflag {
	case tar.TypeDir:
		return os.MkdirAll(target, 0700)
	case tar.TypeReg:
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return err
		}
		output, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, os.FileMode(header.Mode)&0700)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(output, reader)
		closeErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	default:
		return fmt.Errorf("archive contains unsupported entry %q", header.Name)
	}
}
