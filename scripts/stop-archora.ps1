param(
    [string]$ProjectRoot = "$PSScriptRoot\.."
)

$cleanRoot = if ($ProjectRoot) { $ProjectRoot.Trim('"', "'", "`t", " ") } else { "$PSScriptRoot\.." }
$resolvedRoot = [System.IO.Path]::GetFullPath($cleanRoot)

Write-Host "==============================================================" -ForegroundColor DarkYellow
Write-Host "  ARCHORA STUDIO - SHUTDOWN" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor DarkYellow

# Runtime directory on Drive D: with legacy fallback check
$runtimeDir = Join-Path $resolvedRoot "data\runtime"
$pidFile = Join-Path $runtimeDir "archora-pids.json"
if (-not (Test-Path $pidFile) -and $env:LOCALAPPDATA) {
    $legacyPid = Join-Path $env:LOCALAPPDATA "Archora\runtime\archora-pids.json"
    if (Test-Path $legacyPid) {
        $pidFile = $legacyPid
    }
}

$stoppedCount = 0

function Stop-ArchoraProcessSafely {
    param([int]$procId, [string]$roleName)
    if (-not $procId -or $procId -le 0) { return }
    
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if (-not $proc) { return }
    
    # Verify process belongs to Archora / Node runtime before stopping
    $isArchora = $false
    try {
        $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
        if ($cim) {
            $cmd = $cim.CommandLine
            $path = $cim.ExecutablePath
            if ($cmd -like "*Archora*" -or $cmd -like "*tsx*" -or $cmd -like "*vite*" -or $cmd -like "*server/index.ts*" -or $cmd -like "*server/dist*" -or $path -like "*Archora*") {
                $isArchora = $true
            }
        }
    } catch {
        # Fallback if CimInstance fails
        $isArchora = $true
    }
    
    if ($isArchora) {
        # Stop child processes first
        try {
            $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $procId }
            foreach ($child in $children) {
                Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
            }
        } catch {}
        
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        try {
            $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($p) { $p.WaitForExit(1000) }
        } catch {}
        Write-Host "      [OK] Stopped Archora $roleName (PID: $procId)" -ForegroundColor Green
        $script:stoppedCount++
    } else {
        Write-Host "      [SKIPPED] Process $procId does not belong to Archora (preservation active)." -ForegroundColor Yellow
    }
}

# 1. Stop processes recorded in PID file
if (Test-Path $pidFile) {
    try {
        $pidInfo = Get-Content $pidFile | ConvertFrom-Json
        if ($pidInfo.frontendPid) { Stop-ArchoraProcessSafely $pidInfo.frontendPid "Frontend" }
        if ($pidInfo.frontendCmdPid) { Stop-ArchoraProcessSafely $pidInfo.frontendCmdPid "Frontend Launcher" }
        if ($pidInfo.backendPid) { Stop-ArchoraProcessSafely $pidInfo.backendPid "Backend Server" }
        if ($pidInfo.backendCmdPid) { Stop-ArchoraProcessSafely $pidInfo.backendCmdPid "Backend Launcher" }
    } catch {
        Write-Warning "Could not parse PID file: $_"
    }
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

# 2. Check Port 5000 strictly for Archora signature
$netConn5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($netConn5000) {
    foreach ($conn in $netConn5000) {
        $owningProcId = $conn.OwningProcess
        # Verify it's actually Archora via health check or process inspection
        $isArchoraBackend = $false
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 1 -ErrorAction Stop
            if ($res -and $res.service -like "*Archora*") {
                $isArchoraBackend = $true
            }
        } catch {
            # Check command line if health check failed
            $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $owningProcId" -ErrorAction SilentlyContinue
            if ($cim -and ($cim.CommandLine -like "*Archora*" -or $cim.CommandLine -like "*server/index.ts*" -or $cim.CommandLine -like "*server/dist*" -or $cim.CommandLine -like "*tsx*")) {
                $isArchoraBackend = $true
            }
        }
        
        if ($isArchoraBackend) {
            Stop-ArchoraProcessSafely $owningProcId "Backend (Port 5000)"
        }
    }
}

# 3. Check Port 3000 strictly for Archora frontend
$netConn3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($netConn3000) {
    foreach ($conn in $netConn3000) {
        $owningProcId = $conn.OwningProcess
        $isArchoraVite = $false
        $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $owningProcId" -ErrorAction SilentlyContinue
        if ($cim -and ($cim.CommandLine -like "*Archora*" -or $cim.CommandLine -like "*vite*")) {
            $isArchoraVite = $true
        }
        
        if ($isArchoraVite) {
            Stop-ArchoraProcessSafely $owningProcId "Frontend (Port 3000)"
        }
    }
}

Write-Host ""
if ($stoppedCount -gt 0) {
    Write-Host "==============================================================" -ForegroundColor Green
    Write-Host "  ARCHORA STUDIO SERVICES STOPPED CLEANLY" -ForegroundColor Green
    Write-Host "  Total Archora processes terminated: $stoppedCount" -ForegroundColor Green
    Write-Host "  Unrelated Node processes: Untouched" -ForegroundColor Gray
    Write-Host "==============================================================" -ForegroundColor Green
} else {
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "  NO RUNNING ARCHORA SERVICES FOUND" -ForegroundColor Cyan
    Write-Host "  Archora is already stopped." -ForegroundColor Gray
    Write-Host "==============================================================" -ForegroundColor Cyan
}
exit 0

