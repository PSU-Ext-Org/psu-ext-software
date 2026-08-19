// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package release_test

import (
	"archive/tar"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
)

func TestExtractTarGzAcceptsArchiveRootDirectory(t *testing.T) {
	archive := writeArchive(t, []archiveEntry{
		{name: "./", directory: true},
		{name: "./frontend/", directory: true},
		{name: "./frontend/index.html", content: "PSU-EXT"},
	})
	destination := filepath.Join(t.TempDir(), "release")

	if err := release.ExtractTarGz(archive, destination); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(destination, "frontend", "index.html"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "PSU-EXT" {
		t.Fatalf("content = %q, want PSU-EXT", content)
	}
}

func TestExtractTarGzRejectsParentTraversal(t *testing.T) {
	archive := writeArchive(t, []archiveEntry{{name: "../escape", content: "unsafe"}})
	destination := filepath.Join(t.TempDir(), "release")

	if err := release.ExtractTarGz(archive, destination); err == nil {
		t.Fatal("expected unsafe path error")
	}
}

type archiveEntry struct {
	name      string
	content   string
	directory bool
}

func writeArchive(t *testing.T, entries []archiveEntry) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "bundle.tar.gz")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)
	for _, entry := range entries {
		typeflag := byte(tar.TypeReg)
		mode := int64(0600)
		if entry.directory {
			typeflag = tar.TypeDir
			mode = 0700
		}
		header := &tar.Header{
			Name: entry.name, Mode: mode, Typeflag: typeflag, Size: int64(len(entry.content)),
		}
		if err := tarWriter.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if entry.content != "" {
			if _, err := tarWriter.Write([]byte(entry.content)); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}
