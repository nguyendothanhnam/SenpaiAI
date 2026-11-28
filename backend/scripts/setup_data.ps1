param(
    [string]$Python = '',
    [string]$Groups = '',
    [switch]$CheckOnly,
    [switch]$Inventory,
    [switch]$Download,
    [switch]$External,
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$backendDirectory = Split-Path -Parent $PSScriptRoot
if (-not $Python) {
    $localPython = Join-Path $backendDirectory 'venv/Scripts/python.exe'
    if (Test-Path -LiteralPath $localPython) { $Python = $localPython }
    else { $Python = 'python' }
}
$setupArguments = @((Join-Path $PSScriptRoot 'setup_data.py'))
if ($Groups) { $setupArguments += @('--groups', $Groups) }
if ($CheckOnly) { $setupArguments += '--check-only' }
if ($Inventory) { $setupArguments += '--inventory' }
if ($Download) { $setupArguments += '--download' }
if ($External) { $setupArguments += '--external' }
if ($Json) { $setupArguments += '--json' }
Push-Location -LiteralPath $backendDirectory
try { & $Python @setupArguments; $setupExitCode = $LASTEXITCODE }
finally { Pop-Location }
exit $setupExitCode
