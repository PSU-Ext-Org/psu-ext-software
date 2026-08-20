// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package logtail follows installer-managed application log files.
package logtail

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"sort"
	"time"
)

const tailWindow = 256 * 1024

type followedFile struct {
	name   string
	path   string
	info   os.FileInfo
	offset int64
	lines  int
}

// Follow writes the last lineCount lines and then follows additions until the context ends.
func Follow(ctx context.Context, output io.Writer, paths map[string]string, lineCount int) error {
	names := make([]string, 0, len(paths))
	for name := range paths {
		names = append(names, name)
	}
	sort.Strings(names)
	files := make([]*followedFile, 0, len(names))
	for _, name := range names {
		followed := &followedFile{name: name, path: paths[name], lines: lineCount}
		if err := followed.open(output, lineCount, len(paths) > 1); err != nil && !os.IsNotExist(err) {
			return err
		}
		files = append(files, followed)
	}
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			for _, followed := range files {
				if err := followed.readNew(output, len(paths) > 1); err != nil && !os.IsNotExist(err) {
					return err
				}
			}
		}
	}
}

func (followed *followedFile) open(output io.Writer, lineCount int, label bool) error {
	file, err := os.Open(followed.path)
	if err != nil {
		return err
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return err
	}
	start := info.Size() - tailWindow
	if start < 0 {
		start = 0
	}
	if _, err := file.Seek(start, io.SeekStart); err != nil {
		file.Close()
		return err
	}
	content, err := io.ReadAll(file)
	if err != nil {
		file.Close()
		return err
	}
	lines := bytes.Split(content, []byte{'\n'})
	if start > 0 && len(lines) > 0 {
		lines = lines[1:]
	}
	if len(lines) > 0 && len(lines[len(lines)-1]) == 0 {
		lines = lines[:len(lines)-1]
	}
	if len(lines) > lineCount {
		lines = lines[len(lines)-lineCount:]
	}
	if label && len(lines) > 0 {
		_, _ = fmt.Fprintf(output, "--- %s ---\n", followed.name)
	}
	for _, line := range lines {
		_, _ = output.Write(append(line, '\n'))
	}
	followed.info, followed.offset = info, info.Size()
	return file.Close()
}

func (followed *followedFile) readNew(output io.Writer, label bool) error {
	pathInfo, err := os.Stat(followed.path)
	if err != nil {
		return err
	}
	if followed.info == nil || !os.SameFile(followed.info, pathInfo) || pathInfo.Size() < followed.offset {
		followed.info, followed.offset = nil, 0
		return followed.open(output, followed.lines, label)
	}
	if pathInfo.Size() == followed.offset {
		return nil
	}
	file, err := os.Open(followed.path)
	if err != nil {
		return err
	}
	defer file.Close()
	if _, err := file.Seek(followed.offset, io.SeekStart); err != nil {
		return err
	}
	if label {
		_, _ = fmt.Fprintf(output, "--- %s ---\n", followed.name)
	}
	written, err := io.Copy(output, file)
	followed.offset += written
	followed.info = pathInfo
	return err
}
