$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
node (Join-Path $PSScriptRoot 'bundle.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Service bundle failed' }
$buildDir = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
$zipPath = Join-Path $buildDir 'QHSamsung.zip'
$wgtPath = Join-Path $buildDir 'QHSamsung.wgt'
# WGT paths must use '/', even when built on Windows. Compress-Archive from
# Windows PowerShell can emit '\', which a mobile signer may preserve on the TV.
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$sourceRoot = (Resolve-Path (Join-Path $projectRoot 'tizen-app')).Path
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File) {
        $entryName = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Copy-Item -LiteralPath $zipPath -Destination $wgtPath -Force
Write-Output "Created unsigned package: $wgtPath"
