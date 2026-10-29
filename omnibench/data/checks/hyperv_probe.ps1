param(
    [Parameter(Mandatory = $true)]
    [string]$Probe
)

# OmniBench - Hyper-V configuration probe.
# Returns a single scalar value for the requested probe. If the Hyper-V role
# is not installed, returns "false" for module-available and "n/a" for everything
# else, so checks degrade to FAIL with clear evidence instead of throwing.

$ErrorActionPreference = "SilentlyContinue"

$hyperVAvailable = [bool](Get-Command Get-VM -ErrorAction SilentlyContinue)
if (-not $hyperVAvailable) {
    switch ($Probe) {
        "module-available" { "false"; return }
        default            { "n/a";   return }
    }
}

function Get-Gen2VMs {
    Get-VM | Where-Object { $_.Generation -eq 2 }
}

function Get-DeviceGuardInfo {
    Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction SilentlyContinue
}

switch ($Probe) {
    "module-available" { "true" }
    "host-name" {
        $h = Get-VMHost
        if ($h) { $h.Name } else { "unknown" }
    }
    "vm-total"   { [string]@(Get-VM).Count }
    "vm-running" { [string]@(Get-VM | Where-Object { $_.State -eq "Running" }).Count }
    "vm-stopped" { [string]@(Get-VM | Where-Object { $_.State -ne "Running" }).Count }
    "vm-gen2"    { [string]@(Get-Gen2VMs).Count }
    "vm-gen1"    { [string]@(Get-VM | Where-Object { $_.Generation -eq 1 }).Count }

    "vm-secure-boot-off-count" {
        $gen2 = @(Get-Gen2VMs)
        if ($gen2.Count -eq 0) { "0" }
        else { [string]@($gen2 | Get-VMFirmware | Where-Object { $_.SecureBoot -ne "On" }).Count }
    }
    "vm-vtpm-off-count" {
        $gen2 = @(Get-Gen2VMs)
        if ($gen2.Count -eq 0) { "0" }
        else { [string]@($gen2 | ForEach-Object { Get-VMSecurity -VMName $_.Name } | Where-Object { -not $_.TpmEnabled }).Count }
    }
    "vm-guest-services-enabled-count" {
        [string]@(Get-VM | Get-VMIntegrationService -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "Guest Service Interface" -and $_.Enabled }).Count
    }
    "vm-with-snapshots-count" {
        [string]@(Get-VM | Where-Object { @(Get-VMSnapshot -VMName $_.Name -ErrorAction SilentlyContinue).Count -gt 0 }).Count
    }

    "switch-external-count" { [string]@(Get-VMSwitch | Where-Object { $_.SwitchType -eq "External" }).Count }
    "switch-internal-count" { [string]@(Get-VMSwitch | Where-Object { $_.SwitchType -eq "Internal" }).Count }
    "switch-private-count"  { [string]@(Get-VMSwitch | Where-Object { $_.SwitchType -eq "Private"  }).Count }

    "live-migration-enabled" {
        $h = Get-VMHost
        if ($h -and $h.VirtualMachineMigrationEnabled) { "true" } else { "false" }
    }
    "live-migration-auth-type" {
        $h = Get-VMHost
        if ($h) { [string]$h.VirtualMachineMigrationAuthenticationType } else { "unknown" }
    }
    "live-migration-perf-option" {
        $h = Get-VMHost
        if ($h) { [string]$h.VirtualMachineMigrationPerformanceOption } else { "unknown" }
    }
    "replica-server-enabled" {
        $r = Get-VMReplicationServer -ErrorAction SilentlyContinue
        if ($r -and $r.RepEnabled) { "true" } else { "false" }
    }
    "replica-cert-auth-only" {
        $r = Get-VMReplicationServer -ErrorAction SilentlyContinue
        if (-not $r) { "n/a" }
        elseif ($r.KerberosAuthenticationPort -eq 0 -and $r.CertificateAuthenticationPort -gt 0) { "true" }
        else { "false" }
    }

    "default-vm-path-on-system-drive" {
        $h = Get-VMHost
        if (-not $h) { "unknown" }
        else {
            $sys = $env:SystemDrive
            if ($h.VirtualMachinePath -like "$sys*") { "true" } else { "false" }
        }
    }
    "default-vhd-path-on-system-drive" {
        $h = Get-VMHost
        if (-not $h) { "unknown" }
        else {
            $sys = $env:SystemDrive
            if ($h.VirtualHardDiskPath -like "$sys*") { "true" } else { "false" }
        }
    }

    "vbs-enabled" {
        $dg = Get-DeviceGuardInfo
        if (-not $dg) { "false" }
        elseif ($dg.VirtualizationBasedSecurityStatus -eq 2) { "true" }
        else { "false" }
    }
    "credential-guard-running" {
        $dg = Get-DeviceGuardInfo
        if (-not $dg -or -not $dg.SecurityServicesRunning) { "false" }
        elseif ($dg.SecurityServicesRunning -contains 1) { "true" }
        else { "false" }
    }
    "hvci-running" {
        $dg = Get-DeviceGuardInfo
        if (-not $dg -or -not $dg.SecurityServicesRunning) { "false" }
        elseif ($dg.SecurityServicesRunning -contains 2) { "true" }
        else { "false" }
    }

    default { "unknown-probe" }
}
