[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
# Deliberately selects only the existing read-only authenticated-session smoke test.
# Legacy integration suites mutate accounts and are never selected by this script.
if ($env:FIRE_FEAST_RUN_INTEGRATION -ne "1") {
    Write-Host "SKIPPED: set FIRE_FEAST_RUN_INTEGRATION=1 only for approved staging checks."
    exit 0
}
if (-not $env:EXPO_PUBLIC_BACKEND_URL -or -not $env:FIRE_FEAST_INTEGRATION_AUTH_TOKEN) {
    Write-Host "SKIPPED: staging URL and authenticated test credentials are required."
    exit 0
}
if ($env:FIRE_FEAST_INTEGRATION_TARGET -ne "staging" -or -not $env:FIRE_FEAST_STAGING_API_URL) {
    throw "Explicit staging target and FIRE_FEAST_STAGING_API_URL are required."
}
$target = $null
if (-not [Uri]::TryCreate($env:EXPO_PUBLIC_BACKEND_URL, [UriKind]::Absolute, [ref]$target) -or
    $target.Scheme -ne "https" -or $target.UserInfo -or $target.Query -or $target.Fragment -or
    $target.AbsolutePath -ne "/" -or
    $env:EXPO_PUBLIC_BACKEND_URL.TrimEnd("/") -cne $env:FIRE_FEAST_STAGING_API_URL.TrimEnd("/")) {
    throw "The integration URL must be the exact approved HTTPS staging origin."
}
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$pythonCommand = Join-Path $repositoryRoot "backend\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonCommand)) {
    $pythonCommand = (Get-Command python -ErrorAction Stop).Source
}
$env:PYTHONDONTWRITEBYTECODE = "1"
$env:PYTHON_DOTENV_DISABLED = "1"
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = "1"
Push-Location $repositoryRoot
try {
    & $pythonCommand -B -m pytest backend/tests/test_authenticated_integration.py -q -p no:cacheprovider --tb=no --show-capture=no
    $result = $LASTEXITCODE
} finally { Pop-Location }
exit $result
