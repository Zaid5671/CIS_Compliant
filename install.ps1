# OmniBench one-line installer (Windows).
#
# Usage from PowerShell:
#   .\install.ps1                          # install to %ProgramFiles%\OmniBench
#   .\install.ps1 -InstallDir C:\Tools\OB
#   .\install.ps1 -Service                 # also register a scheduled task
#
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:ProgramFiles "OmniBench"),
    [switch]$Service
)

$ErrorActionPreference = "Stop"

# ---- Preflight ------------------------------------------------------------
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Error "Python 3.10+ is required. Install from https://www.python.org/downloads/ and retry."
    exit 1
}

$pyVersion = & $python.Source -c "import sys; print('%d.%d' % sys.version_info[:2])"
if ([version]$pyVersion -lt [version]"3.10") {
    Write-Error "Python 3.10+ required, found $pyVersion"
    exit 1
}

$src = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $src "pyproject.toml"))) {
    Write-Error "Run install.ps1 from the OmniBench source directory."
    exit 1
}

# ---- Install --------------------------------------------------------------
Write-Host "==> Installing OmniBench to $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "==> Creating virtual environment"
& $python.Source -m venv (Join-Path $InstallDir ".venv")
& (Join-Path $InstallDir ".venv\Scripts\python.exe") -m pip install --quiet --upgrade pip
& (Join-Path $InstallDir ".venv\Scripts\python.exe") -m pip install --quiet $src

$shimDir = Join-Path $env:LOCALAPPDATA "OmniBench"
New-Item -ItemType Directory -Force -Path $shimDir | Out-Null

$shimPath = Join-Path $shimDir "omnibench.cmd"
$exe = Join-Path $InstallDir ".venv\Scripts\omnibench.exe"
$shimContent = "@echo off`r`n`"$exe`" %*`r`n"
Set-Content -Path $shimPath -Value $shimContent -Encoding ASCII

Write-Host "==> Created launcher: $shimPath"

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not ($userPath -split ';' | Where-Object { $_ -ieq $shimDir })) {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$shimDir", "User")
    Write-Host "    Added $shimDir to user PATH (open a new terminal to pick it up)."
}

# ---- Optional scheduled task ---------------------------------------------
if ($Service) {
    Write-Host "==> Registering scheduled task 'OmniBench'"
    $configDir = "C:\ProgramData\OmniBench"
    $reportsDir = Join-Path $configDir "reports"
    $tokenFile = Join-Path $configDir "session.token"

    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

    $configFile = Join-Path $configDir "config.ini"
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
    }

    $action = New-ScheduledTaskAction -Execute $exe -Argument "serve --config `"$configFile`""
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName "OmniBench" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName "OmniBench"
    Write-Host "    Scheduled task started. Check Task Scheduler > OmniBench."
}

Write-Host ""
Write-Host "Installed. Open a new terminal and try:"
Write-Host "    omnibench"
Write-Host "    start http://127.0.0.1:8507"
