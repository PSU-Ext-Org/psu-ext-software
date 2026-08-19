// Copyright 2026 The PSU-EXT Authors
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"context"
	"fmt"
	"os"

	"github.com/PSU-Ext-Org/psu-ext-software/psu-install/internal/installer"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "psu-ext:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: psu-ext <install|start|stop|restart|status|logs|update>")
	}

	manager, err := installer.NewManager()
	if err != nil {
		return err
	}
	ctx := context.Background()
	switch args[0] {
	case "install":
		version := ""
		if len(args) == 3 && args[1] == "--version" {
			version = args[2]
		} else if len(args) != 1 {
			return fmt.Errorf("usage: psu-ext install [--version VERSION]")
		}
		return manager.Install(ctx, version)
	case "start", "stop", "restart", "status":
		return manager.ServiceCommand(ctx, args[0])
	case "logs":
		service := ""
		if len(args) == 2 {
			service = args[1]
		} else if len(args) > 2 {
			return fmt.Errorf("usage: psu-ext logs [proxy|runner|caddy]")
		}
		return manager.Logs(ctx, service)
	case "update":
		if len(args) != 1 {
			return fmt.Errorf("usage: psu-ext update")
		}
		return manager.Install(ctx, "")
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}
