# Stops Windows powering down the Blackweb keyboard's USB interface.
#
# The G keys report on a vendor-defined HID interface rather than the
# standard keyboard one. Standard interfaces are registered wake-capable,
# so Windows preserves the keystroke that wakes them -- vendor interfaces
# get no such guarantee, and the first report after the device idles is
# swallowed waking it up. That is why G1/G2 dropped roughly 7 presses in
# 10 when pressed slowly, and got *better* the faster they were spammed:
# rapid presses never let the interface fall asleep.
#
# Needs administrator rights (it writes to HKLM\SYSTEM). Current values
# are saved next to this script first, so it can be undone.

$ErrorActionPreference = 'Stop'
$VID = 'VID_3938&PID_1095'
$base = "HKLM:\SYSTEM\CurrentControlSet\Enum\USB\$VID"

function Say($msg, $colour = 'Gray') { Write-Host "  $msg" -ForegroundColor $colour }

Write-Host ""
Write-Host "  Blackweb keyboard - USB power fix" -ForegroundColor Cyan
Write-Host "  ---------------------------------------------------------"

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Say "This needs to run as administrator." 'Red'
  Say "Right-click the file and choose 'Run as administrator'." 'Red'
  Read-Host "`n  Press Enter to close"
  exit 1
}

if (-not (Test-Path $base)) {
  Say "Keyboard not found in the registry ($VID)." 'Red'
  Say "Is it plugged in?" 'Red'
  Read-Host "`n  Press Enter to close"
  exit 1
}

$backup = Join-Path $PSScriptRoot 'keyboard-power-backup.txt'
$lines = @("Blackweb keyboard USB power settings, saved $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$changed = 0

foreach ($inst in Get-ChildItem $base) {
  $dp = Join-Path $inst.PSPath 'Device Parameters'
  if (-not (Test-Path $dp)) { continue }

  $before = Get-ItemProperty $dp
  $lines += "instance=$($inst.PSChildName) EnhancedPowerManagementEnabled=$($before.EnhancedPowerManagementEnabled) AllowIdleIrpInD3=$($before.AllowIdleIrpInD3)"

  # 0 = never let the computer turn this device off to save power.
  Set-ItemProperty $dp -Name 'EnhancedPowerManagementEnabled' -Value 0 -Type DWord
  Set-ItemProperty $dp -Name 'AllowIdleIrpInD3' -Value 0 -Type DWord

  $after = Get-ItemProperty $dp
  Say "$($inst.PSChildName)  ->  EnhancedPowerManagement=$($after.EnhancedPowerManagementEnabled)  AllowIdleIrpInD3=$($after.AllowIdleIrpInD3)" 'Green'
  $changed++
}

Set-Content -Path $backup -Value $lines -Encoding utf8
Say ""
Say "$changed interface(s) updated. Previous values saved to:" 'Gray'
Say "  $backup" 'DarkGray'

# The driver only re-reads these on re-enumeration.
Say ""
Say "Restarting the keyboard so the change takes effect..." 'Gray'
$restarted = $false
foreach ($inst in Get-ChildItem $base) {
  $id = "USB\$VID\$($inst.PSChildName)"
  try {
    & pnputil /restart-device "$id" | Out-Null
    if ($LASTEXITCODE -eq 0) { $restarted = $true }
  } catch { }
}

Say ""
if ($restarted) {
  Say "Done. Test G1 now - press it once, wait two seconds, press it again." 'Green'
} else {
  Say "Settings are written, but the device did not restart cleanly." 'Yellow'
  Say "Unplug the keyboard, wait five seconds, plug it back in." 'Yellow'
}
Say ""
Say "To undo: set both values back to 1 using keyboard-power-backup.txt." 'DarkGray'
Read-Host "`n  Press Enter to close"
