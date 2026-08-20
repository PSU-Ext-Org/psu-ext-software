// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package release_test

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/release"
)

func TestExtractZipExtractsRegularFiles(t *testing.T) {
	archive := writeZip(t, []zipEntry{
		{name: "frontend/", directory: true},
		{name: "frontend/index.html", content: "PSU-EXT"},
	})
	destination := filepath.Join(t.TempDir(), "release")

	if err := release.ExtractZip(archive, destination); err != nil {
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

func TestExtractZipRejectsUnsafeAndDuplicateEntries(t *testing.T) {
	for _, test := range []struct {
		name    string
		entries []zipEntry
	}{
		{name: "parent traversal", entries: []zipEntry{{name: "../escape", content: "unsafe"}}},
		{name: "backslash traversal", entries: []zipEntry{{name: `..\escape`, content: "unsafe"}}},
		{name: "absolute", entries: []zipEntry{{name: "/escape", content: "unsafe"}}},
		{name: "drive", entries: []zipEntry{{name: `C:\escape`, content: "unsafe"}}},
		{name: "duplicate", entries: []zipEntry{{name: "file.txt", content: "one"}, {name: "FILE.txt", content: "two"}}},
		{name: "symlink", entries: []zipEntry{{name: "link", content: "target", symlink: true}}},
	} {
		t.Run(test.name, func(t *testing.T) {
			archive := writeZip(t, test.entries)
			if err := release.ExtractZip(archive, filepath.Join(t.TempDir(), "release")); err == nil {
				t.Fatal("expected extraction error")
			}
		})
	}
}

func TestValidateWindowsRequiresExecutableLayout(t *testing.T) {
	directory := t.TempDir()
	for _, relative := range []string{
		"runtime/bin/java.exe", "bin/caddy.exe", "apps/psu-be-proxy.jar",
		"apps/psu-be-script-runner.jar", "frontend/index.html",
	} {
		path := filepath.Join(directory, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(relative), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := release.ValidateWindows(directory); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(directory, "bin", "caddy.exe")); err != nil {
		t.Fatal(err)
	}
	if err := release.ValidateWindows(directory); err == nil {
		t.Fatal("expected missing caddy.exe error")
	}
}

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

type zipEntry struct {
	name      string
	content   string
	directory bool
	symlink   bool
}

func writeZip(t *testing.T, entries []zipEntry) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "bundle.zip")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.name, Method: zip.Store}
		switch {
		case entry.directory:
			header.SetMode(os.ModeDir | 0700)
		case entry.symlink:
			header.SetMode(os.ModeSymlink | 0700)
		default:
			header.SetMode(0600)
		}
		output, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := output.Write([]byte(entry.content)); err != nil {
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
