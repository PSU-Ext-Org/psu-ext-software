# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]] $Path
)

$ErrorActionPreference = "Stop"
foreach ($scriptPath in $Path) {
    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        (Resolve-Path -LiteralPath $scriptPath),
        [ref] $tokens,
        [ref] $parseErrors
    ) | Out-Null
    if ($parseErrors.Count -ne 0) {
        $parseErrors | ForEach-Object { Write-Error $_ }
        exit 1
    }
}
