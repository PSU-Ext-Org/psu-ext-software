// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

// Package launchd installs and controls PSU-EXT launch agents on macOS.
package launchd

import (
	"encoding/xml"
	"fmt"
	"strings"
)

type agent struct {
	name             string
	label            string
	executable       string
	arguments        []string
	workingDirectory string
	logPath          string
}

func renderAgent(agent agent) string {
	arguments := append([]string{agent.executable}, agent.arguments...)
	var argumentXML strings.Builder
	for _, argument := range arguments {
		fmt.Fprintf(&argumentXML, "    <string>%s</string>\n", escapeXML(argument))
	}
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>%s</string>
  <key>ProgramArguments</key>
  <array>
%s  </array>
  <key>WorkingDirectory</key>
  <string>%s</string>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>%s</string>
  <key>StandardErrorPath</key>
  <string>%s</string>
</dict>
</plist>
`, escapeXML(agent.label), argumentXML.String(), escapeXML(agent.workingDirectory), escapeXML(agent.logPath), escapeXML(agent.logPath))
}

func escapeXML(value string) string {
	var escaped strings.Builder
	_ = xml.EscapeText(&escaped, []byte(value))
	return escaped.String()
}
