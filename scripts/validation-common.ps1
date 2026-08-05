function Invoke-ValidationStage {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "[$Name] RUNNING"
    & $Command | Out-Host
    $stageExitCode = $LASTEXITCODE
    if ($stageExitCode -eq 0) {
        Write-Host "[$Name] PASS"
        return $true
    }

    Write-Host "[$Name] FAIL (exit $stageExitCode)"
    return $false
}
