/**
 * Copyright 2026 The PSU-EXT Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package installer

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/state"
)

// managedLog matches active logs and the rotated filenames produced by Spring and Caddy.
var managedLog = regexp.MustCompile("^(proxy|runner|caddy)\\.log$|^(proxy|runner)\\.log\\.[0-9-]+\\.[0-9]+\\.gz$|^caddy-[0-9T:.-]+\\.log(\\.gz)?$")

// sharedDirectoryEntries limits deletion inside generic logs and releases directories.
func sharedDirectoryEntries(root *os.Root, entries []string, platform string) ([]string, error) {
	var paths []string
	version := installedVersion(root)
	for _, entry := range entries {
		if entry == "current" || entry == "current.new" {
			if isReleaseLink(root, entry) {
				paths = append(paths, entry)
			}
			continue
		}
		if entry != "logs" && entry != "releases" {
			paths = append(paths, entry)
			continue
		}
		children, err := fs.ReadDir(root.FS(), entry)
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}

		for _, child := range children {
			path := filepath.Join(entry, child.Name())
			owned := entry == "logs" && !child.IsDir() && managedLog.MatchString(child.Name())
			if entry == "releases" {
				owned = isInstalledRelease(root, child, version, platform)
			}
			if owned {
				paths = append(paths, path)
			}
		}
	}
	return paths, nil
}

// isReleaseLink distinguishes the Unix activation link from another project's current directory.
func isReleaseLink(root *os.Root, name string) bool {
	dest, err := root.Readlink(name)
	if err != nil {
		return false
	}
	if !filepath.IsAbs(dest) {
		dest = filepath.Join(root.Name(), dest)
	}
	return inside(filepath.Join(root.Name(), "releases"), dest)
}

// isInstalledRelease identifies the active version, historical PSU-EXT bundles and downloads.
func isInstalledRelease(root *os.Root, child fs.DirEntry, version, platform string) bool {
	name := child.Name()
	if child.IsDir() {
		return name == version || hasReleaseJar(root, filepath.Join("releases", name))
	}
	extension := ".tar.gz"
	if platform == "windows-amd64" {
		extension = ".zip"
	}
	return strings.TrimSuffix(name, ".partial") == "psu-ext-bundle-"+platform+extension
}

// installedVersion reads a regular installer state file without following a link.
func installedVersion(root *os.Root) string {
	const name = "install-state.json"
	info, err := root.Lstat(name)
	if err != nil || !info.Mode().IsRegular() {
		return ""
	}
	data, err := root.ReadFile(name)
	var current state.State
	if err != nil || json.Unmarshal(data, &current) != nil || current.ProxyPort == 0 || current.RunnerPort == 0 || current.CaddyPort == 0 {
		return ""
	}
	return current.Version
}

// hasReleaseJar recognizes PSU-EXT application files in an older release directory.
func hasReleaseJar(root *os.Root, path string) bool {
	jar, err := root.Lstat(filepath.Join(path, "apps", "psu-be-proxy.jar"))
	return err == nil && jar.Mode().IsRegular()
}

// hasInstallationEvidence also recognizes a release when install-state.json is damaged.
func hasInstallationEvidence(root *os.Root, entries []string) bool {
	if installedVersion(root) != "" {
		return true
	}
	for _, entry := range entries {
		if filepath.Dir(entry) == "releases" && hasReleaseJar(root, entry) {
			return true
		}
	}
	return false
}
