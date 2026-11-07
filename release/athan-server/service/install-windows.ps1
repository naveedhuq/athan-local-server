# Run Athan automatically when you log in to Windows. Run from the extracted bundle, in PowerShell:
#   .\service\install-windows.ps1
#   .\service\install-windows.ps1 -Uninstall
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$TaskName = 'Athan Server'

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Get-NetFirewallRule -DisplayName 'Athan Server' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Write-Host 'Removed. Your data folder was left in place.'; exit 0
}

$app = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error 'Node.js 20+ is required. Install it with: winget install OpenJS.NodeJS.LTS'; exit 1 }

$action  = New-ScheduledTaskAction -Execute $node -Argument "`"$app\athan.mjs`"" -WorkingDirectory $app
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Athan prayer-call server' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

# Speakers must be able to reach the server: allow inbound TCP 8080 on private networks (needs admin).
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
  if (-not (Get-NetFirewallRule -DisplayName 'Athan Server' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Athan Server' -Direction Inbound -Protocol TCP -LocalPort 8080 -Profile Private -Action Allow | Out-Null
  }
  Write-Host 'Firewall rule added for port 8080 (private networks).'
} else {
  Write-Host 'Tip: re-run as Administrator once to open port 8080 so speakers can fetch the audio.'
}
Write-Host 'Athan will now start automatically when you log in. Open http://localhost:8080'
