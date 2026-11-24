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

package taskscheduler

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// TestNativeTaskRemoval uses a unique scheduler folder so installed PSU-EXT tasks stay isolated.
func TestNativeTaskRemoval(t *testing.T) {
	if os.Getenv("PSU_EXT_TEST_NATIVE_SERVICES") != "1" {
		t.Skip("set PSU_EXT_TEST_NATIVE_SERVICES=1 to exercise Task Scheduler")
	}
	script, err := filepath.Abs("uninstall.ps1")
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "& ([ScriptBlock]::Create([Console]::In.ReadToEnd()))")
	cmd.Env = append(cmd.Environ(), "PSU_EXT_UNINSTALL_HOME="+t.TempDir(), "PSU_EXT_TEST_SCRIPT="+script)
	cmd.Stdin = strings.NewReader(nativeTaskFixture)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("native uninstall: %v\n%s", err, output)
	}
}

// nativeTaskFixture exercises ownership refusal, a running task, an absent task, and retry.
const nativeTaskFixture = `$ErrorActionPreference = 'Stop'
$scheduler = New-Object -ComObject Schedule.Service
$scheduler.Connect()
$root = $scheduler.GetFolder('\')
$name = "PSU-EXT-test-" + [guid]::NewGuid()
$folder = $root.CreateFolder($name)
try {
    $release = New-Item -ItemType Directory -Path (Join-Path $env:PSU_EXT_UNINSTALL_HOME 'releases')
    $exe = Join-Path $release.FullName 'wscript.exe'
    Copy-Item -LiteralPath (Join-Path $env:WINDIR 'System32\wscript.exe') -Destination $exe
    $waitScript = Join-Path $release.FullName 'wait.vbs'
    Set-Content -LiteralPath $waitScript -Value 'WScript.Sleep 60000'

    $def = $scheduler.NewTask(0)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $def.Principal.UserId = $sid
    $def.Principal.LogonType = 3
    $def.Settings.DisallowStartIfOnBatteries = $false
    $action = $def.Actions.Create(0)
    $action.Path = Join-Path $env:WINDIR 'System32\wscript.exe'
    $action.Arguments = '//B "' + $waitScript + '"'
    $null = $folder.RegisterTaskDefinition('PSU-EXT Caddy',$def,2,$sid,$null,3)

    try {
        & $env:PSU_EXT_TEST_SCRIPT -TaskFolderPath $folder.Path
        throw 'Accepted foreign executable'
    } catch {
        if ($_.Exception.Message -notlike 'Cannot verify*') { throw }
    }

    $action.Path = $exe
    $task = $folder.RegisterTaskDefinition('PSU-EXT Caddy',$def,4,$sid,$null,3)
    $instance = $task.Run($null)
    & $env:PSU_EXT_TEST_SCRIPT -TaskFolderPath $folder.Path
    & $env:PSU_EXT_TEST_SCRIPT -TaskFolderPath $folder.Path
    if ($folder.GetTasks(1).Count -ne 0) { throw 'Task registration survived uninstall' }
} finally {
    foreach ($task in $folder.GetTasks(1)) {
        $task.Stop(0)
        $folder.DeleteTask($task.Name,0)
    }
    $root.DeleteFolder($name,0)
}
`
