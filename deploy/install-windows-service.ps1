# Registers OmniBench as a Windows scheduled task that runs at boot.
# Run as Administrator.
#
# Defaults assume the standalone installer already placed omnibench.exe at
# %ProgramFiles%\OmniBench\.venv\Scripts\omnibench.exe. Override with -ExePath.
[CmdletBinding()]
param(
    [string]$ExePath = (Join-Path $env:ProgramFiles "OmniBench\.venv\Scripts\omnibench.exe"),
    [string]$ConfigDir = "C:\ProgramData\OmniBench",
    [string]$TaskName = "OmniBench"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ExePath)) {
    Write-Error "omnibench.exe not found at $ExePath. Run install.ps1 first or pass -ExePath."
    exit 1
}

$reportsDir = Join-Path $ConfigDir "reports"
$tokenFile = Join-Path $ConfigDir "session.token"
$configFile = Join-Path $ConfigDir "config.ini"

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

if (-not (Test-Path $configFile)) {
    @"
[server]
host = 127.0.0.1
port = 8507
allow_remote = false

[security]
token_file = $tokenFile

[paths]
reports = $reportsDir
"@ | Set-Content -Path $configFile -Encoding UTF8
    Write-Host "Wrote default config to $configFile"
}

$action = New-ScheduledTaskAction -Execute $ExePath -Argument "serve --config `"$configFile`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Scheduled task '$TaskName' registered and started."
Write-Host "Dashboard:    http://127.0.0.1:8507"
Write-Host "Config:       $configFile"
Write-Host "Reports:      $reportsDir"
