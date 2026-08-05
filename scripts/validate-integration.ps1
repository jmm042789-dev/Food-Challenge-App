[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "validation-common.ps1")

$requirements = @(
    @{ Name = "FIRE_FEAST_RUN_INTEGRATION"; Value = $env:FIRE_FEAST_RUN_INTEGRATION },
    @{ Name = "EXPO_PUBLIC_BACKEND_URL"; Value = $env:EXPO_PUBLIC_BACKEND_URL },
    @{ Name = "FIRE_FEAST_INTEGRATION_AUTH_TOKEN"; Value = $env:FIRE_FEAST_INTEGRATION_AUTH_TOKEN }
)
$missing = $requirements | Where-Object { [string]::IsNullOrWhiteSpace($_.Value) }
if ($env:FIRE_FEAST_RUN_INTEGRATION -ne "1" -or $missing.Count -gt 0) {
    $names = ($missing | ForEach-Object { $_.Name }) -join ", "
    if ($env:FIRE_FEAST_RUN_INTEGRATION -ne "1" -and $names -notmatch "FIRE_FEAST_RUN_INTEGRATION") {
        $names = "FIRE_FEAST_RUN_INTEGRATION" + $(if ($names) { ", $names" } else { "" })
    }
    Write-Host "[Live backend integration tests] SKIPPED (set FIRE_FEAST_RUN_INTEGRATION=1 and configure: $names)"
    exit 0
}

$pythonCommand = Join-Path $repositoryRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonCommand)) {
    $pythonCommand = (Get-Command python -ErrorAction Stop).Source
}

Push-Location $repositoryRoot
try {
    $passed = Invoke-ValidationStage "Live backend integration tests" {
        & $pythonCommand -m pytest backend\tests -m "integration" -q
    }
} finally {
    Pop-Location
}

if (-not $passed) {
    Write-Host "INTEGRATION VALIDATION FAIL"
    exit 1
}
Write-Host "INTEGRATION VALIDATION PASS"
exit 0
