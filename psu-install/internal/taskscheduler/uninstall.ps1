<#
Copyright 2026 The PSU-EXT Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
#>

param([string]$TaskFolderPath = '\')

$ErrorActionPreference = 'Stop'
$installation = $env:PSU_EXT_UNINSTALL_HOME

# Confirm that the task belongs to this account and runs the installed release.
function Assert-InstallationTask($task, $sid, $installation) {
    $definition = $task.Definition
    $principal = $definition.Principal.UserId
    if ($principal -notlike 'S-1-*') {
        $principal = ([Security.Principal.NTAccount]$principal).Translate([Security.Principal.SecurityIdentifier]).Value
    }
    $action = $definition.Actions.Item(1)
    $releases = [IO.Path]::Combine($installation, 'releases') + '\'
    if ($sid -ne $principal -or $definition.Actions.Count -ne 1 -or
        -not [IO.Path]::GetFullPath($action.Path).StartsWith($releases, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Cannot verify that scheduled task '$($task.Name)' belongs to this installation."
    }
}

# Disable restarts and wait for any running instance to stop before deletion.
function Stop-InstallationTask($task) {
    $task.Enabled = $false
    if ($task.GetInstances(0).Count -gt 0) {
        $task.Stop(0)
        $deadline = [DateTime]::UtcNow.AddSeconds(30)
        while ($task.GetInstances(0).Count -gt 0) {
            if ([DateTime]::UtcNow -ge $deadline) { throw "Timed out stopping '$($task.Name)'." }
            Start-Sleep -Milliseconds 200
        }
    }
}

# Connect to the current user's Task Scheduler session.
$scheduler = New-Object -ComObject 'Schedule.Service'
$scheduler.Connect()
$folder = $scheduler.GetFolder($TaskFolderPath)
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value

foreach ($name in 'PSU-EXT Caddy', 'PSU-EXT Runner', 'PSU-EXT Proxy') {
    # Missing tasks are expected when retrying a partial uninstall.
    try {
        $task = $folder.GetTask($name)
    } catch {
        if ($_.Exception.GetBaseException().HResult -eq -2147024894) { continue }
        throw
    }

    Assert-InstallationTask $task $sid $installation
    Stop-InstallationTask $task
    $folder.DeleteTask($name, 0)
}
