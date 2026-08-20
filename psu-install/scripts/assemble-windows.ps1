# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Version
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$work = Join-Path $root "psu-install\build\windows-amd64"
$bundle = Join-Path $work "psu-ext-bundle-windows-amd64"
$dist = Join-Path $root "psu-install\dist"
$descriptor = Get-Content -Raw -LiteralPath (Join-Path $root "psu-install\platforms\windows-amd64.json") | ConvertFrom-Json

function Assert-Checksum([string] $Path, [string] $Algorithm, [string] $Expected) {
    $actual = (Get-FileHash -Algorithm $Algorithm -LiteralPath $Path).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw "checksum mismatch for $Path"
    }
}

function Assert-ExecutableJar([string] $Path) {
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $archive.GetEntry("META-INF/MANIFEST.MF")
        if (-not $entry) { throw "$Path has no JAR manifest" }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { $manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($manifest -notmatch "Main-Class: org\.springframework\.boot\.loader\.launch\.JarLauncher" -or
            $manifest -notmatch "Start-Class: ") {
            throw "$Path is not an executable Spring Boot JAR"
        }
    } finally {
        $archive.Dispose()
    }
}

if (Test-Path -LiteralPath $work) { Remove-Item -Recurse -Force -LiteralPath $work }
if (Test-Path -LiteralPath $dist) { Remove-Item -Recurse -Force -LiteralPath $dist }
New-Item -ItemType Directory -Force -Path (
    "$bundle\apps", "$bundle\frontend", "$bundle\runtime", "$bundle\bin", "$bundle\licenses", $dist
) | Out-Null

Push-Location (Join-Path $root "psu-be")
try {
    & .\mvnw.cmd -B -pl psu-be-proxy,psu-be-script-runner -am package
    if ($LASTEXITCODE -ne 0) { throw "Maven build failed" }
    $proxyJar = Get-ChildItem "psu-be-proxy\target\psu-be-proxy-*.jar" | Where-Object { $_.Name -notmatch "\.original$" } | Select-Object -First 1
    $runnerJar = Get-ChildItem "psu-be-script-runner\target\psu-be-script-runner-*.jar" | Where-Object { $_.Name -notmatch "\.original$" } | Select-Object -First 1
    Copy-Item -LiteralPath $proxyJar.FullName -Destination "$bundle\apps\psu-be-proxy.jar"
    Copy-Item -LiteralPath $runnerJar.FullName -Destination "$bundle\apps\psu-be-script-runner.jar"
    Assert-ExecutableJar "$bundle\apps\psu-be-proxy.jar"
    Assert-ExecutableJar "$bundle\apps\psu-be-script-runner.jar"
} finally {
    Pop-Location
}

Push-Location (Join-Path $root "psu-fe")
try {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
    Copy-Item -Recurse -Force -Path "dist\*" -Destination "$bundle\frontend"
} finally {
    Pop-Location
}

$caddyZip = Join-Path $work "caddy.zip"
$caddyExtract = Join-Path $work "caddy"
Invoke-WebRequest -UseBasicParsing -Uri $descriptor.components.caddy.url -OutFile $caddyZip
Assert-Checksum $caddyZip SHA512 $descriptor.components.caddy.sha512
[IO.Compression.ZipFile]::ExtractToDirectory($caddyZip, $caddyExtract)
Copy-Item -LiteralPath "$caddyExtract\caddy.exe" -Destination "$bundle\bin\caddy.exe"
Copy-Item -LiteralPath "$caddyExtract\LICENSE" -Destination "$bundle\licenses\CADDY-LICENSE"

$temurinZip = Join-Path $work "temurin.zip"
$temurinExtract = Join-Path $work "temurin"
Invoke-WebRequest -UseBasicParsing -Uri $descriptor.components.temurin.url -OutFile $temurinZip
Assert-Checksum $temurinZip SHA256 $descriptor.components.temurin.sha256
[IO.Compression.ZipFile]::ExtractToDirectory($temurinZip, $temurinExtract)
$java = Get-ChildItem -Recurse -File -Filter java.exe -Path $temurinExtract |
    Where-Object { $_.FullName -match "[\\/]bin[\\/]java\.exe$" } | Select-Object -First 1
if (-not $java) { throw "Temurin archive has no bin\java.exe" }
$temurinRoot = Split-Path -Parent (Split-Path -Parent $java.FullName)
Copy-Item -Recurse -Force -Path "$temurinRoot\*" -Destination "$bundle\runtime"
Copy-Item -Recurse -Force -LiteralPath "$bundle\runtime\legal" -Destination "$bundle\licenses\temurin-legal"
Copy-Item -LiteralPath (Join-Path $root "psu-install\THIRD-PARTY-NOTICES.md") -Destination "$bundle\licenses\THIRD-PARTY-NOTICES.md"

$bundleZip = Join-Path $dist "psu-ext-bundle-windows-amd64.zip"
[IO.Compression.ZipFile]::CreateFromDirectory($bundle, $bundleZip, [IO.Compression.CompressionLevel]::Optimal, $false)

Push-Location (Join-Path $root "psu-install")
try {
    & go build -trimpath -ldflags "-s -w" -o "dist\psu-ext-windows-amd64.exe" .\cmd\psu-ext
    if ($LASTEXITCODE -ne 0) { throw "Go build failed" }
} finally {
    Pop-Location
}
$installer = Join-Path $dist "psu-ext-windows-amd64.exe"
if ((Get-Item -LiteralPath $installer).Length -gt 15MB) {
    throw "Windows installer exceeds the 15 MiB size limit"
}

& python (Join-Path $root "psu-install\scripts\generate-release-metadata.py") $Version $dist
if ($LASTEXITCODE -ne 0) { throw "release metadata generation failed" }
