[CmdletBinding()]
param([switch]$BackendOnly)
$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "validation-common.ps1")
$pythonCommand = Join-Path $repositoryRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonCommand)) {
    $pythonCommand = (Get-Command python -ErrorAction Stop).Source
}
$adapter = Join-Path $repositoryRoot "frontend\scripts\validation\backend-local.py"
# Preserve caller settings without printing them; no live configuration reaches tests.
$localValues = @{
    FIRE_FEAST_ENV="test"; PYTHONDONTWRITEBYTECODE="1"; PYTHON_DOTENV_DISABLED="1";
    PYTEST_DISABLE_PLUGIN_AUTOLOAD="1"; PYTEST_ADDOPTS="-p no:cacheprovider";
    EXPO_NO_DOTENV="1"; EXPO_OFFLINE="1"; EXPO_NO_TYPESCRIPT_SETUP="1"
}
$removed = @("MONGO_URL","DB_NAME","EXPO_PUBLIC_BACKEND_URL","FIRE_FEAST_INTEGRATION_AUTH_TOKEN",
    "FIRE_FEAST_RUN_INTEGRATION","HTTP_PROXY","HTTPS_PROXY","ALL_PROXY")
$saved = @{}
foreach ($name in (@($localValues.Keys) + $removed)) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
$failed = $false
Push-Location $repositoryRoot
try {
    foreach ($name in $removed) { [Environment]::SetEnvironmentVariable($name, $null, "Process") }
    foreach ($name in $localValues.Keys) { [Environment]::SetEnvironmentVariable($name, $localValues[$name], "Process") }
    if (-not (Invoke-ValidationStage "Backend deterministic tests" {
        & $pythonCommand -B $adapter tests (Join-Path $repositoryRoot "backend")
    })) { $failed = $true }
    if (-not $BackendOnly) {
        $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
        $nodeCommand = (Get-Command node -ErrorAction Stop).Source
        $tscCommand = Join-Path $repositoryRoot "frontend\node_modules\typescript\bin\tsc"
        if (-not (Test-Path -LiteralPath $tscCommand)) {
            throw "Missing frontend dependencies. Run the approved npm ci --ignore-scripts --no-audit --no-fund in frontend."
        }
        if (-not (Invoke-ValidationStage "Frontend tests" {
            Push-Location frontend
            try { & $npmCommand "test" } finally { Pop-Location }
        })) { $failed = $true }
        if (-not (Invoke-ValidationStage "TypeScript (whole project)" {
            & $nodeCommand $tscCommand --project frontend/tsconfig.json --noEmit --incremental false
        })) { $failed = $true }
        if (-not (Invoke-ValidationStage "Render staging configuration" {
            & $nodeCommand frontend/scripts/validation/deployment.js
        })) { $failed = $true }
        if (-not (Invoke-ValidationStage "Production PNG integrity" {
            & $nodeCommand frontend/scripts/check-png-integrity.js
        })) { $failed = $true }
        if (-not (Invoke-ValidationStage "ESLint (no fix or cache)" {
            Push-Location frontend
            try { & $nodeCommand node_modules/eslint/bin/eslint.js . } finally { Pop-Location }
        })) { $failed = $true }
    }
    if (-not (Invoke-ValidationStage "Git diff check" {
        & git --no-optional-locks -c "safe.directory=$repositoryRoot" -c core.safecrlf=false -c core.whitespace=cr-at-eol diff --check
    })) { $failed = $true }
} finally {
    Pop-Location
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name], "Process") }
}
if ($failed) { Write-Host "VALIDATION FAIL"; exit 1 }
Write-Host "VALIDATION PASS"
exit 0
