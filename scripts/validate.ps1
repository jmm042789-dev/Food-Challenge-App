[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "validation-common.ps1")

$pythonCommand = Join-Path $repositoryRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonCommand)) {
    $pythonCommand = (Get-Command python -ErrorAction Stop).Source
}
$npmCommand = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCommand) {
    $npmCommand = (Get-Command npm -ErrorAction Stop).Source
}
$tscCommand = Join-Path $repositoryRoot "frontend\node_modules\.bin\tsc.cmd"
if (-not (Test-Path -LiteralPath $tscCommand)) {
    throw "TypeScript is unavailable. Restore the existing frontend dependencies before validation."
}

$failed = $false
Push-Location $repositoryRoot
try {
    if (-not (Invoke-ValidationStage "Backend deterministic tests" {
        & $pythonCommand -m pytest backend\tests -m "not integration" -q
    })) { $failed = $true }

    if (-not (Invoke-ValidationStage "Frontend tests" {
        Push-Location frontend
        try { & $npmCommand "test" } finally { Pop-Location }
    })) { $failed = $true }

    if (-not (Invoke-ValidationStage "TypeScript" {
        & $tscCommand "--project" "frontend\tsconfig.json" "--noEmit"
    })) { $failed = $true }

    if (-not (Invoke-ValidationStage "ESLint" {
        Push-Location frontend
        try { & $npmCommand "run" "lint" } finally { Pop-Location }
    })) { $failed = $true }

    if (-not (Invoke-ValidationStage "Git diff check" { & git diff --check })) {
        $failed = $true
    }
    if (-not (Invoke-ValidationStage "Git status" { & git status --short })) {
        $failed = $true
    }
} finally {
    Pop-Location
}

if ($failed) {
    Write-Host "VALIDATION FAIL"
    exit 1
}
Write-Host "VALIDATION PASS"
exit 0
