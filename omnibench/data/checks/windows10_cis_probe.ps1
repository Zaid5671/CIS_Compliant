param(
    [Parameter(Mandatory = $true)]
    [string]$Probe
)

$ErrorActionPreference = "SilentlyContinue"

function Get-NetAccountsValue {
    param([string]$Label)

    $line = net accounts | Select-String -Pattern $Label | Select-Object -First 1
    if (-not $line) {
        return "missing"
    }

    $value = ($line.ToString() -replace ".*:\s*", "").Trim()
    if ($value -match "^(Never|Unlimited|None)$") {
        return $value
    }
    if ($value -match "(\d+)") {
        return $Matches[1]
    }
    return $value
}

function Get-RegistryValue {
    param(
        [string]$Path,
        [string]$Name,
        [object]$Default = "missing"
    )

    $item = Get-ItemProperty -Path $Path -Name $Name
    if ($null -eq $item) {
        return $Default
    }
    return $item.$Name
}

function Get-BooleanText {
    param([object]$Value)

    if ($Value -eq $true) { return "true" }
    if ($Value -eq $false) { return "false" }
    if ($Value -eq 1) { return "true" }
    if ($Value -eq 0) { return "false" }
    return [string]$Value
}

switch ($Probe) {
    "password-history" {
        Get-NetAccountsValue "Length of password history maintained"
    }
    "min-password-length" {
        Get-NetAccountsValue "Minimum password length"
    }
    "max-password-age" {
        $value = Get-NetAccountsValue "Maximum password age"
        if ($value -match "^(Never|Unlimited|None)$") { "999999" } else { $value }
    }
    "min-password-age" {
        Get-NetAccountsValue "Minimum password age"
    }
    "lockout-threshold-compliant" {
        $value = Get-NetAccountsValue "Lockout threshold"
        if ($value -match "^(Never|Unlimited|None)$") {
            "false"
        } elseif ([int]$value -gt 0 -and [int]$value -le 5) {
            "true"
        } else {
            "false"
        }
    }
    "lockout-duration" {
        Get-NetAccountsValue "Lockout duration"
    }
    "lockout-window" {
        Get-NetAccountsValue "Lockout observation window"
    }
    "guest-disabled" {
        $user = Get-LocalUser -Name "Guest"
        if ($null -eq $user) { "true" } else { Get-BooleanText (-not $user.Enabled) }
    }
    "administrator-disabled" {
        $user = Get-LocalUser | Where-Object { $_.SID.Value -match "-500$" } | Select-Object -First 1
        if ($null -eq $user) { "missing" } else { Get-BooleanText (-not $user.Enabled) }
    }
    "firewall-domain" {
        Get-BooleanText ((Get-NetFirewallProfile -Profile Domain).Enabled)
    }
    "firewall-private" {
        Get-BooleanText ((Get-NetFirewallProfile -Profile Private).Enabled)
    }
    "firewall-public" {
        Get-BooleanText ((Get-NetFirewallProfile -Profile Public).Enabled)
    }
    "defender-realtime" {
        if (Get-Command Get-MpPreference) {
            Get-BooleanText (-not (Get-MpPreference).DisableRealtimeMonitoring)
        } else {
            "missing"
        }
    }
    "defender-cloud" {
        if (Get-Command Get-MpPreference) {
            $value = (Get-MpPreference).MAPSReporting
            if ([int]$value -gt 0) { "true" } else { "false" }
        } else {
            "missing"
        }
    }
    "rdp-disabled" {
        $value = Get-RegistryValue "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" "fDenyTSConnections"
        Get-BooleanText ($value -eq 1)
    }
    "uac-enabled" {
        $value = Get-RegistryValue "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" "EnableLUA"
        Get-BooleanText ($value -eq 1)
    }
    "uac-admin-consent-secure-desktop" {
        $value = Get-RegistryValue "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" "PromptOnSecureDesktop"
        Get-BooleanText ($value -eq 1)
    }
    "auto-admin-logon-disabled" {
        $value = Get-RegistryValue "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" "AutoAdminLogon" "0"
        Get-BooleanText ($value -ne "1")
    }
    "smb1-disabled" {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
        if ($null -eq $feature) {
            $value = Get-RegistryValue "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" "SMB1" 0
            Get-BooleanText ($value -eq 0)
        } else {
            Get-BooleanText ($feature.State -ne "Enabled")
        }
    }
    "llmnr-disabled" {
        $value = Get-RegistryValue "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" "EnableMulticast" "missing"
        Get-BooleanText ($value -eq 0)
    }
    "screen-saver-secure" {
        $value = Get-RegistryValue "HKCU:\Control Panel\Desktop" "ScreenSaverIsSecure" "0"
        Get-BooleanText ($value -eq "1")
    }
    "screen-saver-timeout-compliant" {
        $value = Get-RegistryValue "HKCU:\Control Panel\Desktop" "ScreenSaveTimeOut" "999999"
        if ([int]$value -gt 0 -and [int]$value -le 900) { "true" } else { "false" }
    }
    default {
        "unknown-probe"
        exit 2
    }
}

