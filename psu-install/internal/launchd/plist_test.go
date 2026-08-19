// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package launchd

import (
	"encoding/xml"
	"strings"
	"testing"
)

func TestRenderAgentEscapesPathsAndArguments(t *testing.T) {
	content := renderAgent(agent{
		label:            "com.psuext.proxy",
		executable:       "/Users/test/PSU & EXT/java",
		arguments:        []string{"-jar", "/tmp/proxy.jar"},
		workingDirectory: "/Users/test/data",
		logPath:          "/Users/test/proxy.log",
	})
	for _, expected := range []string{"com.psuext.proxy", "PSU &amp; EXT", "<string>-jar</string>", "<key>KeepAlive</key>"} {
		if !strings.Contains(content, expected) {
			t.Errorf("rendered plist does not contain %q", expected)
		}
	}
	if err := xml.Unmarshal([]byte(content), new(any)); err != nil {
		t.Fatalf("rendered plist is not valid XML: %v", err)
	}
}
