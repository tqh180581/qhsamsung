$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
node (Join-Path $PSScriptRoot 'bundle.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Service bundle failed' }
$buildDir = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
$zipPath = Join-Path $buildDir 'QHSamsung.zip'
$wgtPath = Join-Path $buildDir 'QHSamsung.wgt'
Compress-Archive -Path (Join-Path $projectRoot 'tizen-app\*') -DestinationPath $zipPath -Force
Copy-Item -LiteralPath $zipPath -Destination $wgtPath -Force
Write-Output "Created unsigned package: $wgtPath"
