function Invoke-ValidationStage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true, Position=0)][string]$Name,
        [Parameter(Mandatory=$true, Position=1)][scriptblock]$Action
    )
    $ErrorActionPreference = "Stop"
    $global:LASTEXITCODE = 0
    try {
        & $Action | ForEach-Object { Write-Host $_ }
        $stageExitCode = $global:LASTEXITCODE
        if ($stageExitCode -ne 0) {
            Write-Host "[$Name] FAIL (exit $stageExitCode)"
            return $false
        }
        Write-Host "[$Name] PASS"
        return $true
    } catch {
        # Do not print arbitrary exception messages that might contain credentials.
        Write-Host "[$Name] FAIL (exception $($_.Exception.GetType().Name))"
        return $false
    }
}
