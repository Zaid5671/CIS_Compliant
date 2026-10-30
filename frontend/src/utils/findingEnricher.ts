import { CheckResult, Severity } from '../types';

export interface EnrichedFindingDetails {
  auditCommand: string;
  auditType: string;
  expectedBaseline: string;
  expectedDescription: string;
  actualValue: string;
  actualDescription: string;
  remediationInstructions: string;
  remediationCommand: string;
  remediationShell: string;
  nistControls: string[];
  cisSafeguards: string[];
  mitreAttack: string[];
  scorePenalty: number;
}

// Windows 10 CIS check mappings
const WINDOWS_CHECK_ENRICHMENTS: Record<string, {
  auditCmd: string;
  auditType: string;
  fixCmd: string;
  guiSteps: string;
  nist: string[];
  cis: string[];
  mitre: string[];
  expectedDesc: string;
  actualExplain?: (actual: string) => string;
}> = {
  '1.1.1': {
    auditCmd: 'net accounts | findstr /i "Length of password history"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /uniquepw:24',
    guiSteps: 'Open Local Security Policy (secpol.msc) -> Security Settings -> Account Policies -> Password Policy -> Set "Enforce password history" to 24 or more passwords.',
    nist: ['IA-5(1) Password Authenticator History'],
    cis: ['CIS 5.2 Unique Passwords'],
    mitre: ['T1110 Brute Force'],
    expectedDesc: 'Baseline requires maintaining a history of at least 24 unique passwords.',
    actualExplain: (val) => val === 'None' || !val ? 'Password history is not configured (None) in Windows Local Security Policy.' : `Current history length is ${val} passwords (below 24).`,
  },
  '1.1.2': {
    auditCmd: 'net accounts | findstr /i "Maximum password age"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /maxpwage:365',
    guiSteps: 'Open secpol.msc -> Account Policies -> Password Policy -> Set "Maximum password age" to 365 days or fewer (not 0).',
    nist: ['IA-5(1) Password Expiration'],
    cis: ['CIS 5.2 Password Aging'],
    mitre: ['T1078 Valid Accounts'],
    expectedDesc: 'Maximum lifetime of a password must be 365 days or fewer to limit exposure.',
  },
  '1.1.3': {
    auditCmd: 'net accounts | findstr /i "Minimum password age"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /minpwage:1',
    guiSteps: 'Open secpol.msc -> Account Policies -> Password Policy -> Set "Minimum password age" to at least 1 day.',
    nist: ['IA-5(1) Password Change Frequency'],
    cis: ['CIS 5.2 Password Retention'],
    mitre: ['T1110 Brute Force'],
    expectedDesc: 'Minimum password age must be >= 1 day to prevent users from bypassing history.',
    actualExplain: (val) => val === '0' ? 'Password age is 0 days, allowing users to immediately cycle passwords.' : `Current minimum age is ${val} days.`,
  },
  '1.1.4': {
    auditCmd: 'net accounts | findstr /i "Minimum password length"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /minpwlen:14',
    guiSteps: 'Open secpol.msc -> Account Policies -> Password Policy -> Set "Minimum password length" to 14 or more characters.',
    nist: ['IA-5(1) Password Complexity'],
    cis: ['CIS 5.2 Password Length'],
    mitre: ['T1110.001 Password Guessing'],
    expectedDesc: 'Passphrase/password must have a minimum length of 14 characters.',
    actualExplain: (val) => `Current minimum password length configured is ${val} characters (below 14).`,
  },
  '1.2.1': {
    auditCmd: 'net accounts | findstr /i "Lockout threshold"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /lockoutthreshold:5',
    guiSteps: 'Open secpol.msc -> Account Policies -> Account Lockout Policy -> Set "Account lockout threshold" between 1 and 5 invalid attempts.',
    nist: ['AC-7 Unsuccessful Logon Attempts'],
    cis: ['CIS 5.3 Lockout Threshold'],
    mitre: ['T1110.001 Password Spraying'],
    expectedDesc: 'Lockout threshold must be configured between 1 and 5 failed attempts.',
    actualExplain: (val) => val === '0' || val === 'False' ? 'Account lockout is disabled (0 attempts). Accounts are vulnerable to unlimited brute force.' : `Lockout threshold is set to ${val}.`,
  },
  '1.2.2': {
    auditCmd: 'net accounts | findstr /i "Lockout duration"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /lockoutduration:15',
    guiSteps: 'Open secpol.msc -> Account Policies -> Account Lockout Policy -> Set "Account lockout duration" to 15 or more minutes.',
    nist: ['AC-7 Account Lockout Duration'],
    cis: ['CIS 5.3 Account Lockout'],
    mitre: ['T1110 Brute Force'],
    expectedDesc: 'Account lockout duration must be at least 15 minutes.',
  },
  '1.2.3': {
    auditCmd: 'net accounts | findstr /i "Lockout observation window"',
    auditType: 'PowerShell / Net Accounts Query',
    fixCmd: 'net accounts /lockoutwindow:15',
    guiSteps: 'Open secpol.msc -> Account Policies -> Account Lockout Policy -> Set "Reset account lockout counter after" to 15 or more minutes.',
    nist: ['AC-7 Lockout Counter Reset'],
    cis: ['CIS 5.3 Account Lockout Observation'],
    mitre: ['T1110 Brute Force'],
    expectedDesc: 'Observation window must be configured to 15 or more minutes.',
  },
  '2.2.1': {
    auditCmd: 'net user Guest | findstr /i "Account active"',
    auditType: 'PowerShell / User Query',
    fixCmd: 'net user Guest /active:no',
    guiSteps: 'Open Computer Management (compmgmt.msc) -> Local Users and Groups -> Users -> Right-click Guest -> Properties -> Check "Account is disabled".',
    nist: ['AC-2 Account Management', 'AC-3 Access Enforcement'],
    cis: ['CIS 5.4 Restrict Default Accounts'],
    mitre: ['T1078.001 Default Accounts'],
    expectedDesc: 'Built-in local Guest account must be disabled (Account active: No).',
    actualExplain: (val) => val === 'Yes' || val === 'False' ? 'Guest account is active, permitting unauthenticated local access.' : 'Guest account state is compliant.',
  },
  '2.2.2': {
    auditCmd: 'net user Administrator | findstr /i "Account active"',
    auditType: 'PowerShell / User Query',
    fixCmd: 'net user Administrator /active:no',
    guiSteps: 'Open compmgmt.msc -> Local Users and Groups -> Users -> Right-click Administrator -> Properties -> Check "Account is disabled".',
    nist: ['AC-2 Account Management', 'AC-6 Least Privilege'],
    cis: ['CIS 5.4 Restrict Default Accounts'],
    mitre: ['T1078.001 Default Accounts'],
    expectedDesc: 'Built-in local Administrator account must be disabled.',
  },
  '9.1.1': {
    auditCmd: 'Get-NetFirewallProfile -Profile Domain | Select-Object -ExpandProperty Enabled',
    auditType: 'PowerShell Host Firewall Query',
    fixCmd: 'Set-NetFirewallProfile -Profile Domain -Enabled True',
    guiSteps: 'Open Windows Defender Firewall with Advanced Security -> Windows Defender Firewall Properties -> Domain Profile -> Set Firewall state to "On (recommended)".',
    nist: ['SC-7 Boundary Protection', 'CM-7 Least Functionality'],
    cis: ['CIS 4.4 Host-Based Firewalls'],
    mitre: ['T1021 Remote Services Lateral Movement'],
    expectedDesc: 'Windows Defender Firewall Domain profile must be Enabled (True).',
  },
  '9.2.1': {
    auditCmd: 'Get-NetFirewallProfile -Profile Private | Select-Object -ExpandProperty Enabled',
    auditType: 'PowerShell Host Firewall Query',
    fixCmd: 'Set-NetFirewallProfile -Profile Private -Enabled True',
    guiSteps: 'Open Windows Defender Firewall -> Properties -> Private Profile -> Set Firewall state to "On".',
    nist: ['SC-7 Boundary Protection'],
    cis: ['CIS 4.4 Host-Based Firewalls'],
    mitre: ['T1021 Remote Services Lateral Movement'],
    expectedDesc: 'Windows Defender Firewall Private profile must be Enabled (True).',
  },
  '9.3.1': {
    auditCmd: 'Get-NetFirewallProfile -Profile Public | Select-Object -ExpandProperty Enabled',
    auditType: 'PowerShell Host Firewall Query',
    fixCmd: 'Set-NetFirewallProfile -Profile Public -Enabled True',
    guiSteps: 'Open Windows Defender Firewall -> Properties -> Public Profile -> Set Firewall state to "On".',
    nist: ['SC-7 Boundary Protection'],
    cis: ['CIS 4.4 Host-Based Firewalls'],
    mitre: ['T1021 Remote Services Lateral Movement'],
    expectedDesc: 'Windows Defender Firewall Public profile must be Enabled (True).',
  },
  '18.9.45.1': {
    auditCmd: 'Get-MpPreference | Select-Object -ExpandProperty DisableRealtimeMonitoring',
    auditType: 'PowerShell Defender WMI Query',
    fixCmd: 'Set-MpPreference -DisableRealtimeMonitoring $false',
    guiSteps: 'Open Windows Security -> Virus & threat protection -> Manage settings -> Toggle "Real-time protection" to On.',
    nist: ['SI-3 Malicious Code Protection'],
    cis: ['CIS 10.1 Anti-Malware Software'],
    mitre: ['T1562.001 Impair Defenses: Disable Tools'],
    expectedDesc: 'Microsoft Defender Real-time Protection must be Active (DisableRealtimeMonitoring = False).',
  },
  '18.9.45.2': {
    auditCmd: 'Get-Service -Name WinDefend | Select-Object -ExpandProperty Status',
    auditType: 'PowerShell Service State Query',
    fixCmd: 'Start-Service -Name WinDefend',
    guiSteps: 'Open Services (services.msc) -> Locate "Microsoft Defender Antivirus Service" -> Right-click -> Start.',
    nist: ['SI-3 Malicious Code Protection', 'SI-4 Information System Monitoring'],
    cis: ['CIS 10.1 Anti-Malware Deployment'],
    mitre: ['T1562 Impair Defenses'],
    expectedDesc: 'Microsoft Defender Antivirus service must be in "Running" status.',
  },
  '18.9.45.3': {
    auditCmd: 'Get-MpPreference | Select-Object -ExpandProperty MAPSReporting',
    auditType: 'PowerShell Defender WMI Query',
    fixCmd: 'Set-MpPreference -MAPSReporting Advanced',
    guiSteps: 'Open Windows Security -> Virus & threat protection -> Manage settings -> Enable "Cloud-delivered protection".',
    nist: ['SI-3 Malicious Code Protection'],
    cis: ['CIS 10.1 Anti-Malware Cloud Protection'],
    mitre: ['T1562 Impair Defenses'],
    expectedDesc: 'Cloud protection (MAPSReporting) must be enabled (Advanced or Standard).',
  },
  '18.9.58.1': {
    auditCmd: '(Get-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server").fDenyTSConnections',
    auditType: 'Registry Hive Value Query',
    fixCmd: 'Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 1',
    guiSteps: 'Open System Properties -> Remote tab -> Select "Don\'t allow remote connections to this computer".',
    nist: ['AC-17 Remote Access', 'SC-7 Boundary Protection'],
    cis: ['CIS 4.3 Network Port Protection'],
    mitre: ['T1021.001 Remote Desktop Protocol'],
    expectedDesc: 'Remote Desktop access must be disabled (fDenyTSConnections = 1) unless business-authorized.',
  },
  '2.3.17.1': {
    auditCmd: '(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System").EnableLUA',
    auditType: 'Registry Hive Value Query',
    fixCmd: 'Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "EnableLUA" -Value 1',
    guiSteps: 'Open secpol.msc -> Local Policies -> Security Options -> "User Account Control: Run all administrators in Admin Approval Mode" -> Set to Enabled.',
    nist: ['AC-6 Least Privilege', 'CM-7 Least Functionality'],
    cis: ['CIS 5.6 User Access Control'],
    mitre: ['T1548.002 Bypass User Account Control'],
    expectedDesc: 'User Account Control (EnableLUA) must be Enabled (1).',
  },
  '2.3.17.2': {
    auditCmd: '(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System").PromptOnSecureDesktop',
    auditType: 'Registry Hive Value Query',
    fixCmd: 'Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "PromptOnSecureDesktop" -Value 1',
    guiSteps: 'Open secpol.msc -> Security Options -> "User Account Control: Switch to the secure desktop when prompting for elevation" -> Set to Enabled.',
    nist: ['AC-6 Least Privilege'],
    cis: ['CIS 5.6 Secure Desktop Elevation'],
    mitre: ['T1548.002 Bypass User Account Control'],
    expectedDesc: 'UAC elevation prompt must appear on isolated Secure Desktop (PromptOnSecureDesktop = 1).',
  },
  '18.4.3': {
    auditCmd: 'Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol | Select-Object -ExpandProperty State',
    auditType: 'PowerShell Feature Query',
    fixCmd: 'Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart',
    guiSteps: 'Open "Turn Windows features on or off" -> Uncheck "SMB 1.0/CIFS File Sharing Support" -> Click OK.',
    nist: ['CM-7 Least Functionality', 'SC-8 Transmission Confidentiality'],
    cis: ['CIS 4.5 Insecure Protocol Decommissioning'],
    mitre: ['T1210 Exploitation of Remote Services (EternalBlue)'],
    expectedDesc: 'Insecure legacy SMBv1 protocol must be Disabled.',
  },
  '18.5.4.1': {
    auditCmd: '(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient" -ErrorAction SilentlyContinue).EnableMulticast',
    auditType: 'Registry Hive Value Query',
    fixCmd: 'New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient" -Force | Out-Null; Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient" -Name "EnableMulticast" -Value 0',
    guiSteps: 'Open gpedit.msc -> Computer Configuration -> Administrative Templates -> Network -> DNS Client -> "Turn off multicast name resolution" -> Enabled.',
    nist: ['SC-8 Transmission Confidentiality', 'SC-20 Secure Name/Address Resolution'],
    cis: ['CIS 4.5 LLMNR Spoofing Prevention'],
    mitre: ['T1557.001 LLMNR/NBT-NS Poisoning'],
    expectedDesc: 'Link-Local Multicast Name Resolution (LLMNR) must be Disabled (EnableMulticast = 0).',
  },
  '18.9.64.1': {
    auditCmd: 'Get-Service -Name wuauserv | Select-Object -ExpandProperty Status',
    auditType: 'PowerShell Service State Query',
    fixCmd: 'Set-Service -Name wuauserv -StartupType Automatic; Start-Service -Name wuauserv',
    guiSteps: 'Open services.msc -> Locate "Windows Update" -> Startup type "Automatic" -> Start service.',
    nist: ['SI-2 Flaw Remediation (Patching)'],
    cis: ['CIS 7.1 Vulnerability Management'],
    mitre: ['T1190 Exploit Public-Facing Application'],
    expectedDesc: 'Windows Update service (wuauserv) must be Running to receive security patches.',
  },
  '18.9.13.1': {
    auditCmd: '(Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -ErrorAction SilentlyContinue).AutoAdminLogon',
    auditType: 'Registry Hive Value Query',
    fixCmd: 'Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon" -Name "AutoAdminLogon" -Value "0"',
    guiSteps: 'Ensure automatic logon is disabled in registry and clear plaintext credentials from Winlogon.',
    nist: ['IA-2 Identification and Authentication'],
    cis: ['CIS 5.1 Account Protection'],
    mitre: ['T1552 Unsecured Credentials'],
    expectedDesc: 'AutoAdminLogon must be disabled ("0") to prevent unauthorized reboot logon.',
  },
  '19.1.3.1': {
    auditCmd: '(Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop").ScreenSaverIsSecure',
    auditType: 'User Registry Query',
    fixCmd: 'Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "ScreenSaverIsSecure" -Value "1"',
    guiSteps: 'Open Settings -> Personalization -> Lock screen -> Screen saver settings -> Check "On resume, display logon screen".',
    nist: ['AC-11 Device Lock'],
    cis: ['CIS 5.5 Session Inactivity Lock'],
    mitre: ['T1078 Valid Accounts (Unattended Session)'],
    expectedDesc: 'Screen saver must require password on resume (ScreenSaverIsSecure = 1).',
  },
  '19.1.3.2': {
    auditCmd: '(Get-ItemProperty -Path "HKCU:\\Control Panel\\Desktop").ScreenSaveTimeOut',
    auditType: 'User Registry Query',
    fixCmd: 'Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "ScreenSaveTimeOut" -Value "900"',
    guiSteps: 'Open Screen Saver Settings -> Set "Wait" time to 15 minutes (900 seconds) or fewer.',
    nist: ['AC-11 Device Lock Duration'],
    cis: ['CIS 5.5 Session Inactivity Lock'],
    mitre: ['T1078 Valid Accounts (Unattended Session)'],
    expectedDesc: 'Screen saver inactivity timeout must be <= 900 seconds (15 minutes).',
  },
  '5.1': {
    auditCmd: 'Get-Service -Name RemoteRegistry | Select-Object -Property StartType, Status',
    auditType: 'PowerShell Service Query',
    fixCmd: 'Set-Service -Name RemoteRegistry -StartupType Disabled; Stop-Service -Name RemoteRegistry -Force -ErrorAction SilentlyContinue',
    guiSteps: 'Open services.msc -> Locate "Remote Registry" -> Properties -> Startup type "Disabled" -> Click Stop.',
    nist: ['CM-7 Least Functionality', 'AC-3 Access Enforcement'],
    cis: ['CIS 4.3 Port & Service Minimization'],
    mitre: ['T1112 Modify Registry / Lateral Recon'],
    expectedDesc: 'Remote Registry service must be Disabled to stop remote registry modification.',
  },
  '9.4.1': {
    auditCmd: 'Get-Service -Name mpssvc | Select-Object -ExpandProperty Status',
    auditType: 'PowerShell Service State Query',
    fixCmd: 'Set-Service -Name mpssvc -StartupType Automatic; Start-Service -Name mpssvc',
    guiSteps: 'Open services.msc -> Locate "Windows Defender Firewall" (mpssvc) -> Startup type "Automatic" -> Start.',
    nist: ['SC-7 Boundary Protection'],
    cis: ['CIS 4.4 Host-Based Firewalls'],
    mitre: ['T1562 Impair Defenses'],
    expectedDesc: 'Windows Defender Firewall core service (mpssvc) must be Running.',
  },
  '18.9.26.1': {
    auditCmd: 'Get-Service -Name EventLog | Select-Object -ExpandProperty Status',
    auditType: 'PowerShell Service State Query',
    fixCmd: 'Set-Service -Name EventLog -StartupType Automatic; Start-Service -Name EventLog',
    guiSteps: 'Open services.msc -> Locate "Windows Event Log" -> Startup type "Automatic" -> Start.',
    nist: ['AU-12 Audit Record Generation', 'AU-2 Event Logging'],
    cis: ['CIS 8.2 Audit Log Collection'],
    mitre: ['T1562.002 Impair Defenses: Disable Windows Event Logging'],
    expectedDesc: 'Windows Event Log service must be Running and set to Automatic.',
  },
};

export function enrichFinding(finding: CheckResult, assetName?: string): EnrichedFindingDetails {
  const checkId = finding.check_id;
  const mapped = WINDOWS_CHECK_ENRICHMENTS[checkId];

  // 1. Audit Command resolution
  let auditCmd = finding.command || '';
  let auditType = 'CLI Audit Command';

  if (mapped) {
    auditCmd = mapped.auditCmd;
    auditType = mapped.auditType;
  } else if (auditCmd.includes('windows10_cis_probe.ps1')) {
    auditType = 'PowerShell CIS Probe';
  } else if (finding.type === 'registry') {
    auditType = 'Windows Registry Query';
  } else if (finding.type === 'service') {
    auditType = 'System Service Status Check';
  } else if (finding.type === 'manual') {
    auditType = 'Manual Review Checklist';
    auditCmd = 'Manual administrative audit required.';
  } else if (!auditCmd) {
    auditCmd = `Query ${finding.title}`;
  }

  // 2. Expected output explanation
  let expectedBaseline = finding.expected || 'exit code 0';
  let expectedDesc = mapped?.expectedDesc || '';
  if (!expectedDesc) {
    if (expectedBaseline.startsWith('gte ')) {
      expectedDesc = `Value must be greater than or equal to ${expectedBaseline.replace('gte ', '')}.`;
    } else if (expectedBaseline.startsWith('lte ')) {
      expectedDesc = `Value must be less than or equal to ${expectedBaseline.replace('lte ', '')}.`;
    } else if (expectedBaseline.includes('equals true') || expectedBaseline === 'true') {
      expectedDesc = 'Setting must be enabled / active (true).';
    } else if (expectedBaseline.includes('equals false') || expectedBaseline === 'false') {
      expectedDesc = 'Setting must be disabled / inactive (false).';
    } else if (expectedBaseline.includes('running')) {
      expectedDesc = 'Service status must be Running.';
    } else {
      expectedDesc = `Device configuration must deterministically match: ${expectedBaseline}`;
    }
  }

  // 3. Actual output explanation
  let actualValue = finding.actual || (finding.status === 'PASS' ? 'Compliant' : 'None / Not set');
  let actualDesc = '';
  if (mapped?.actualExplain) {
    actualDesc = mapped.actualExplain(actualValue);
  } else if (actualValue === 'None' || actualValue === 'null' || !actualValue) {
    actualDesc = 'Device returned no value or setting is unconfigured/missing from host policy.';
  } else if (finding.status === 'PASS') {
    actualDesc = 'Current device configuration fully satisfies the CIS baseline requirement.';
  } else {
    actualDesc = `Current system value '${actualValue}' deviates from CIS benchmark recommendation.`;
  }

  // 4. Remediation resolution (Dual view: Instructions + Runnable Command)
  let remediationInstructions = finding.remediation;
  let remediationCommand = '';
  let remediationShell = 'PowerShell (Run as Administrator)';

  if (mapped) {
    remediationInstructions = mapped.guiSteps;
    remediationCommand = mapped.fixCmd;
  } else {
    // If finding.remediation looks like a command (e.g. starts with configure terminal, set, etc.)
    const rem = finding.remediation.trim();
    if (rem.startsWith('configure terminal') || rem.startsWith('config system') || rem.startsWith('set ') || rem.startsWith('net ') || rem.startsWith('Set-') || rem.startsWith('systemctl') || rem.startsWith('sed ')) {
      remediationCommand = rem;
      remediationInstructions = finding.title ? `Apply hardening command to resolve: ${finding.title}` : 'Execute the CLI command below to remediate.';
      if (rem.startsWith('configure terminal')) {
        remediationShell = 'Cisco IOS CLI (Privileged EXEC)';
      } else if (rem.startsWith('config system') || rem.startsWith('config firewall')) {
        remediationShell = 'FortiOS CLI';
      } else if (rem.startsWith('set rulebase')) {
        remediationShell = 'PAN-OS CLI';
      } else if (rem.startsWith('systemctl') || rem.startsWith('sed ')) {
        remediationShell = 'Bash (root)';
      }
    } else {
      remediationInstructions = finding.remediation;
      remediationCommand = `# Review policy: ${finding.title}\n# Follow organizational change control procedure.`;
    }
  }

  // 5. Compliance Framework Mappings (NIST, CIS Safeguards, MITRE)
  const nistControls = mapped?.nist || (finding.metadata?.nist_controls as string[]) || ['NIST SP 800-53 Rev 5: CM-6 Configuration Settings'];
  const cisSafeguards = mapped?.cis || (finding.metadata?.cis_controls as string[]) || ['CIS Control v8: 4.1 Secure Configuration'];
  const mitreAttack = mapped?.mitre || ['MITRE ATT&CK: Enterprise Initial Access / Persistence'];

  // 6. Score penalty calculation
  const sev = (finding.severity || 'medium').toLowerCase() as Severity;
  const weights: Record<Severity, number> = {
    critical: 10,
    high: 8,
    medium: 4,
    low: 2,
    info: 0,
  };
  const scorePenalty = finding.status === 'PASS' ? 0 : (weights[sev] || 4);

  return {
    auditCommand: auditCmd,
    auditType,
    expectedBaseline,
    expectedDescription: expectedDesc,
    actualValue,
    actualDescription: actualDesc,
    remediationInstructions,
    remediationCommand,
    remediationShell,
    nistControls,
    cisSafeguards,
    mitreAttack,
    scorePenalty,
  };
}

export function generateMarkdownTicket(finding: CheckResult, assetName?: string): string {
  const enriched = enrichFinding(finding, assetName);
  return `### [CIS Finding] [${finding.check_id}] ${finding.title}
- **Target Asset:** ${assetName || 'Audited Machine'}
- **Category:** ${finding.category}
- **Benchmark Profile:** ${finding.profile || 'Level 1'}
- **Status:** ${finding.status}
- **Severity:** ${finding.severity.toUpperCase()} (Score Impact: -${enriched.scorePenalty} pts)

#### 1. Audit Verification Probe
\`\`\`powershell
${enriched.auditCommand}
\`\`\`

#### 2. Deterministic Comparison
- **Expected CIS Value:** \`${enriched.expectedBaseline}\`
  _${enriched.expectedDescription}_
- **Actual Device State:** \`${enriched.actualValue}\`
  _${enriched.actualDescription}_

#### 3. Actionable Remediation
**Instructions:**
${enriched.remediationInstructions}

**CLI Remediation Command (${enriched.remediationShell}):**
\`\`\`powershell
${enriched.remediationCommand}
\`\`\`

#### 4. Compliance Framework Cross-Mapping
- **NIST 800-53:** ${enriched.nistControls.join(', ')}
- **CIS Controls v8:** ${enriched.cisSafeguards.join(', ')}
- **MITRE ATT&CK:** ${enriched.mitreAttack.join(', ')}

#### 5. Security Rationale
> ${finding.rationale || 'Mitigates unauthorized access and maintains defense-in-depth security posture.'}
`;
}

