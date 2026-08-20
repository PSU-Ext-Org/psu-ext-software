# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0
#
# Downloads the latest Windows x64 psu-ext CLI, verifies its published SHA-256
# checksum, and installs it under LocalAppData by default.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $IsWindows -or
    [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne
        [System.Runtime.InteropServices.Architecture]::X64) {
    throw "psu-ext: install-windows.ps1 requires Windows x64"
}

$binary = "psu-ext-windows-amd64.exe"
$targetDirectory = if ($env:PSU_EXT_BIN_DIR) {
    $env:PSU_EXT_BIN_DIR
} else {
    Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Programs\PSU-EXT"
}
$releaseRoot = if ($env:PSU_EXT_RELEASE_BASE_URL) {
    $env:PSU_EXT_RELEASE_BASE_URL.TrimEnd("/")
} else {
    "https://github.com/PSU-Ext-Org/psu-ext-software/releases"
}
$baseUrl = "$releaseRoot/latest/download"
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("psu-ext-" + [guid]::NewGuid())

try {
    New-Item -ItemType Directory -Force -Path $temporaryDirectory, $targetDirectory | Out-Null
    $binaryPath = Join-Path $temporaryDirectory $binary
    $checksumsPath = Join-Path $temporaryDirectory "checksums.txt"

    Write-Host "Downloading the Windows x64 CLI: $binary"
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$binary" -OutFile $binaryPath
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/checksums.txt" -OutFile $checksumsPath

    $escapedBinary = [regex]::Escape($binary)
    $checksumLine = Get-Content -LiteralPath $checksumsPath |
        Where-Object { $_ -match "^([0-9a-fA-F]{64})\s+\*?$escapedBinary$" } |
        Select-Object -First 1
    if (-not $checksumLine) {
        throw "psu-ext: checksums.txt has no entry for $binary"
    }
    $expected = ([regex]::Match($checksumLine, "^[0-9a-fA-F]{64}")).Value.ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $binaryPath).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "psu-ext: checksum verification failed for $binary"
    }

    $target = Join-Path $targetDirectory "psu-ext.exe"
    Copy-Item -Force -LiteralPath $binaryPath -Destination $target
    Write-Host "Installed $target"
    Write-Host "Ensure $targetDirectory is on PATH, then run: psu-ext install"
    Write-Host "The initial Windows executable is unsigned; Windows SmartScreen approval may be required."
} finally {
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -Recurse -Force -LiteralPath $temporaryDirectory
    }
}
