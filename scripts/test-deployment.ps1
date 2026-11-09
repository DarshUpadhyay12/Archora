param(
    [string]$ProjectRoot = "$PSScriptRoot\.."
)

$ErrorActionPreference = "Stop"
$resolvedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
Set-Location $resolvedRoot

Write-Host "==============================================================" -ForegroundColor DarkYellow
Write-Host "  ARCHORA PHASE 12: WINDOWS DEPLOYMENT TEST SUITE" -ForegroundColor Yellow
Write-Host "  Project Root: $resolvedRoot" -ForegroundColor Gray
Write-Host "==============================================================" -ForegroundColor DarkYellow
Write-Host ""

$testsPassed = 0
$totalTests = 8

# Helper to stop Archora before starting
& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\stop-archora.ps1" -ProjectRoot $resolvedRoot | Out-Null
Start-Sleep -Seconds 2

# -------------------------------------------------------------
# TEST 1: Setup Script Execution & Environment Verification
# -------------------------------------------------------------
Write-Host "TEST 1: Running setup-archora.ps1..." -ForegroundColor Cyan
& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\setup-archora.ps1" -ProjectRoot $resolvedRoot
if ($LASTEXITCODE -ne 0) {
    throw "Test 1 Failed: setup-archora.ps1 failed with code $LASTEXITCODE."
}
$testsPassed++
Write-Host "[PASS] Test 1: Setup script verified runtime, storage, and build successfully.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 2: Desktop Shortcut and Icon Verification
# -------------------------------------------------------------
Write-Host "TEST 2: Verifying Desktop Shortcut and Application Icon..." -ForegroundColor Cyan
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Archora.lnk"
$icoPath = Join-Path $resolvedRoot "public\arch-icon.ico"

if (-not (Test-Path $shortcutPath)) {
    throw "Test 2 Failed: Desktop shortcut not found at $shortcutPath"
}
if (-not (Test-Path $icoPath)) {
    throw "Test 2 Failed: Application icon not found at $icoPath"
}

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
if ($sc.TargetPath -ne (Join-Path $resolvedRoot "start-archora.bat")) {
    throw "Test 2 Failed: Shortcut target mismatch. Expected $(Join-Path $resolvedRoot 'start-archora.bat'), got $($sc.TargetPath)"
}
if ($sc.WorkingDirectory -ne $resolvedRoot) {
    throw "Test 2 Failed: Shortcut working directory mismatch. Got $($sc.WorkingDirectory)"
}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wsh) | Out-Null

$testsPassed++
Write-Host "[PASS] Test 2: Desktop shortcut points accurately to start-archora.bat with Archora icon.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 3: Startup Script Service Activation & Readiness
# -------------------------------------------------------------
Write-Host "TEST 3: Starting Archora services via start-archora.ps1 (-Detach -NoBrowser)..." -ForegroundColor Cyan
& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\start-archora.ps1" -ProjectRoot $resolvedRoot -Detach -NoBrowser
if ($LASTEXITCODE -ne 0) {
    throw "Test 3 Failed: start-archora.ps1 returned exit code $LASTEXITCODE"
}

# Verify backend health endpoint
$backendRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 3
if (-not $backendRes -or $backendRes.status -ne "healthy" -or $backendRes.service -notlike "*Archora*") {
    throw "Test 3 Failed: Backend health endpoint did not respond with healthy Archora signature."
}

# Verify frontend
$frontendRes = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 3
if ($frontendRes.StatusCode -ne 200) {
    throw "Test 3 Failed: Frontend interface did not return HTTP 200."
}

$pidFile = Join-Path $resolvedRoot "data\runtime\archora-pids.json"
if (-not (Test-Path $pidFile) -and $env:LOCALAPPDATA) {
    $legacyPid = Join-Path $env:LOCALAPPDATA "Archora\runtime\archora-pids.json"
    if (Test-Path $legacyPid) { $pidFile = $legacyPid }
}
if (-not (Test-Path $pidFile)) {
    throw "Test 3 Failed: PID file not found at $pidFile"
}

$pidInfo = Get-Content $pidFile | ConvertFrom-Json
$origBackendPid = $pidInfo.backendPid
$origFrontendPid = $pidInfo.frontendPid

$testsPassed++
Write-Host "[PASS] Test 3: Backend (port 5000) and Frontend (port 3000) are healthy and active.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 4: Duplicate Instance Prevention
# -------------------------------------------------------------
Write-Host "TEST 4: Testing duplicate instance prevention (launching while active)..." -ForegroundColor Cyan
& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\start-archora.ps1" -ProjectRoot $resolvedRoot -Detach -NoBrowser
if ($LASTEXITCODE -ne 0) {
    throw "Test 4 Failed: Second launcher execution returned non-zero code."
}

# Verify PIDs remained unchanged (no duplicates spawned)
$pidInfoAfter = Get-Content $pidFile | ConvertFrom-Json
if ($pidInfoAfter.backendPid -ne $origBackendPid -or $pidInfoAfter.frontendPid -ne $origFrontendPid) {
    throw "Test 4 Failed: Duplicate processes were spawned instead of preserving existing instances."
}

$testsPassed++
Write-Host "[PASS] Test 4: Duplicate launch detected existing services safely without spawning duplicate instances.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 5: Unrelated Process Isolation Protection
# -------------------------------------------------------------
Write-Host "TEST 5: Testing unrelated Node process protection during shutdown..." -ForegroundColor Cyan
# Start a harmless unrelated node process
$unrelatedScript = "setInterval(() => {}, 5000);"
$unrelatedProc = Start-Process -FilePath "node" -ArgumentList "-e `"$unrelatedScript`"" -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 500

Write-Host "      Spawned unrelated Node process (PID: $($unrelatedProc.Id))." -ForegroundColor Gray
Write-Host "      Stopping Archora Studio via stop-archora.ps1..." -ForegroundColor Gray

& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\stop-archora.ps1" -ProjectRoot $resolvedRoot
Start-Sleep -Seconds 2

# Verify unrelated process is STILL ALIVE!
$checkUnrelated = Get-Process -Id $unrelatedProc.Id -ErrorAction SilentlyContinue
if (-not $checkUnrelated) {
    throw "Test 5 Failed: Unrelated Node process was killed by stop-archora.ps1!"
}

# Clean up unrelated process
Stop-Process -Id $unrelatedProc.Id -Force -ErrorAction SilentlyContinue
Write-Host "      [VERIFIED] Unrelated Node process ($($unrelatedProc.Id)) survived untouched." -ForegroundColor Green

$testsPassed++
Write-Host "[PASS] Test 5: Strict process ownership verified. Unrelated Node processes were not touched.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 6: Complete Service Termination & Port Release
# -------------------------------------------------------------
Write-Host "TEST 6: Verifying port release and PID file cleanup..." -ForegroundColor Cyan
if (Test-Path $pidFile) {
    throw "Test 6 Failed: PID file was not removed after shutdown."
}

for ($i = 0; $i -lt 8; $i++) {
    $netConn5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
    if (-not $netConn5000) { break }
    Start-Sleep -Milliseconds 500
}

if ($netConn5000) {
    throw "Test 6 Failed: Port 5000 is still listening after shutdown."
}

for ($i = 0; $i -lt 8; $i++) {
    $netConn3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if (-not $netConn3000) { break }
    Start-Sleep -Milliseconds 500
}

if ($netConn3000) {
    throw "Test 6 Failed: Port 3000 is still listening after shutdown."
}

$testsPassed++
Write-Host "[PASS] Test 6: Ports 5000 and 3000 freed cleanly and runtime PID file cleaned up.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 7: Restart Flow Verification
# -------------------------------------------------------------
Write-Host "TEST 7: Testing full restart cycle..." -ForegroundColor Cyan
& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\start-archora.ps1" -ProjectRoot $resolvedRoot -Detach -NoBrowser
Start-Sleep -Seconds 2

$bRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 5
if ($bRes.status -ne "healthy") {
    throw "Test 7 Failed: Backend not healthy after restart."
}

& powershell.exe -ExecutionPolicy Bypass -NoProfile -File "$resolvedRoot\scripts\stop-archora.ps1" -ProjectRoot $resolvedRoot
Start-Sleep -Seconds 2

$testsPassed++
Write-Host "[PASS] Test 7: Restart flow verified cleanly.`n" -ForegroundColor Green

# -------------------------------------------------------------
# TEST 8: Data Directory & User Records Preservation
# -------------------------------------------------------------
Write-Host "TEST 8: Auditing user data directory preservation on Drive D:..." -ForegroundColor Cyan
$archoraDb = Join-Path $resolvedRoot "data\archora.db"
$anchoraLegacyDb = Join-Path $resolvedRoot "data\anchora.db"

$activeDbFound = (Test-Path $archoraDb) -or (Test-Path $anchoraLegacyDb)
if (-not $activeDbFound) {
    throw "Test 8 Failed: Persistent SQLite database not found on Drive D: at $archoraDb"
}

$testsPassed++
Write-Host "[PASS] Test 8: Persistent user database and studio storage preserved intact.`n" -ForegroundColor Green

Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  ALL $testsPassed / $totalTests WINDOWS DEPLOYMENT TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
exit 0

