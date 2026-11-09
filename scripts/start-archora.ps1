param(
    [string]$ProjectRoot = "$PSScriptRoot\..",
    [switch]$NoBrowser,
    [switch]$Detach,
    [switch]$Interactive
)

$cleanRoot = if ($ProjectRoot) { $ProjectRoot.Trim('"', "'", "`t", " ") } else { "$PSScriptRoot\.." }
$resolvedRoot = [System.IO.Path]::GetFullPath($cleanRoot)
Set-Location $resolvedRoot

Write-Host "==============================================================" -ForegroundColor DarkYellow
Write-Host "  ARCHORA STUDIO - LAUNCHER" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor DarkYellow

# Runtime directory strictly on Drive D: to avoid writing to full Drive C:
$runtimeDir = Join-Path $resolvedRoot "data\runtime"
if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

$pidFile = Join-Path $runtimeDir "archora-pids.json"
$backendLog = Join-Path $runtimeDir "backend.log"
$backendErrLog = Join-Path $runtimeDir "backend-err.log"
$frontendLog = Join-Path $runtimeDir "frontend.log"
$frontendErrLog = Join-Path $runtimeDir "frontend-err.log"

# Ultra-fast socket check (10-60ms)
function Test-PortListening([string]$hostAddress, [int]$port, [int]$timeoutMs = 80) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($hostAddress, $port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne($timeoutMs, $false)
        if ($wait) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# Step 1: Check if Archora is already running
Write-Host "[1/4] Checking existing service status..." -ForegroundColor Cyan

$backendListening = Test-PortListening "127.0.0.1" 5000 80
$frontendListening = Test-PortListening "127.0.0.1" 3000 80

if ($backendListening -and $frontendListening) {
    Write-Host "      [INFO] Archora services are already active and healthy!" -ForegroundColor Green
    Write-Host "      Backend:  http://127.0.0.1:5000/api/health" -ForegroundColor Gray
    Write-Host "      Frontend: http://127.0.0.1:3000" -ForegroundColor Gray
    if (-not $NoBrowser) {
        Write-Host "      Opening studio in your default browser..." -ForegroundColor Yellow
        Start-Process "http://127.0.0.1:3000"
    }
    Write-Host "`nTo stop Archora, run 'stop-archora.bat'." -ForegroundColor Cyan
    exit 0
}

# Direct Node execution for maximum speed and zero npx overhead
$nodeExe = "node"
$distServerScript = Join-Path $resolvedRoot "server\dist\index.js"
$tsxScript = Join-Path $resolvedRoot "node_modules\tsx\dist\cli.mjs"
$viteScript = Join-Path $resolvedRoot "node_modules\vite\bin\vite.js"

# Ensure fast pre-compiled server exists for sub-second startup
if (-not (Test-Path $distServerScript)) {
    $buildScript = Join-Path $resolvedRoot "scripts\build-server.cjs"
    if (Test-Path $buildScript) {
        Write-Host "      Pre-compiling fast backend bundle (one-time ~200ms)..." -ForegroundColor Gray
        & $nodeExe $buildScript | Out-Null
    }
}

$backendArgs = if (Test-Path $distServerScript) {
    "server/dist/index.js"
} elseif (Test-Path $tsxScript) {
    "`"$tsxScript`" server/index.ts"
} else {
    "node_modules/tsx/dist/cli.mjs server/index.ts"
}

$frontendArgs = if (Test-Path $viteScript) {
    "`"$viteScript`" --port 3000"
} else {
    "node_modules/vite/bin/vite.js --port 3000"
}

# Step 2: Start or Connect Backend Service
Write-Host "[2/4] Starting Archora Backend Server (port 5000)..." -ForegroundColor Cyan

$backendProc = $null
$listeningBackendPid = 0

if ($backendListening) {
    Write-Host "      [OK] Backend is already running on port 5000." -ForegroundColor Green
    $backendReady = $true
} else {
    try {
        Set-Content -Path $backendLog -Value "--- Archora Backend Starting at $(Get-Date) ---`r`n" -ErrorAction SilentlyContinue
        Set-Content -Path $backendErrLog -Value "--- Archora Backend Errors at $(Get-Date) ---`r`n" -ErrorAction SilentlyContinue
    } catch {}

    $backendProc = Start-Process -FilePath $nodeExe `
        -ArgumentList $backendArgs `
        -WorkingDirectory $resolvedRoot `
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError $backendErrLog `
        -WindowStyle Hidden `
        -PassThru

    # Fast poll for backend readiness (up to 200 * 60ms = 12s, usually succeeds in ~900ms)
    $backendReady = $false
    for ($i = 0; $i -lt 200; $i++) {
        Start-Sleep -Milliseconds 60
        if (Test-PortListening "127.0.0.1" 5000 60) {
            $backendReady = $true
            break
        }
    }

    if (-not $backendReady) {
        Write-Host "      [ERROR] Backend failed to start within timeout." -ForegroundColor Red
        Write-Host "      Recent backend log output:" -ForegroundColor Yellow
        if (Test-Path $backendLog) {
            Get-Content $backendLog -Tail 15 | ForEach-Object { Write-Host "        $_" -ForegroundColor Gray }
        }
        if (Test-Path $backendErrLog) {
            Get-Content $backendErrLog -Tail 15 | ForEach-Object { Write-Host "        [ERR] $_" -ForegroundColor Red }
        }
        if ($backendProc) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
        exit 1
    }
}

$listeningBackendPid = if ($backendProc) { $backendProc.Id } else { 0 }
try {
    $netConn5000 = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($netConn5000 -and $netConn5000.OwningProcess -gt 0) { $listeningBackendPid = $netConn5000.OwningProcess }
} catch {}
Write-Host "      [OK] Backend healthy on http://127.0.0.1:5000 (PID: $listeningBackendPid)" -ForegroundColor Green

# Step 3: Start or Connect Frontend Interface
Write-Host "[3/4] Starting Archora Frontend Interface (port 3000)..." -ForegroundColor Cyan

$frontendProc = $null
$listeningFrontendPid = 0

if ($frontendListening) {
    Write-Host "      [OK] Frontend is already running on port 3000." -ForegroundColor Green
    $frontendReady = $true
} else {
    try {
        Set-Content -Path $frontendLog -Value "--- Archora Frontend Starting at $(Get-Date) ---`r`n" -ErrorAction SilentlyContinue
        Set-Content -Path $frontendErrLog -Value "--- Archora Frontend Errors at $(Get-Date) ---`r`n" -ErrorAction SilentlyContinue
    } catch {}

    $frontendProc = Start-Process -FilePath $nodeExe `
        -ArgumentList $frontendArgs `
        -WorkingDirectory $resolvedRoot `
        -RedirectStandardOutput $frontendLog `
        -RedirectStandardError $frontendErrLog `
        -WindowStyle Hidden `
        -PassThru

    # Fast poll for frontend readiness (up to 150 * 60ms = 9s, usually succeeds in ~800ms)
    $frontendReady = $false
    for ($i = 0; $i -lt 150; $i++) {
        Start-Sleep -Milliseconds 60
        if (Test-PortListening "127.0.0.1" 3000 60) {
            $frontendReady = $true
            break
        }
    }

    if (-not $frontendReady) {
        Write-Host "      [ERROR] Frontend failed to start within timeout." -ForegroundColor Red
        Write-Host "      Recent frontend log output:" -ForegroundColor Yellow
        if (Test-Path $frontendLog) {
            Get-Content $frontendLog -Tail 15 | ForEach-Object { Write-Host "        $_" -ForegroundColor Gray }
        }
        if (Test-Path $frontendErrLog) {
            Get-Content $frontendErrLog -Tail 15 | ForEach-Object { Write-Host "        [ERR] $_" -ForegroundColor Red }
        }
        if ($frontendProc) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
        if ($listeningBackendPid -and $backendProc) { Stop-Process -Id $listeningBackendPid -Force -ErrorAction SilentlyContinue }
        exit 1
    }
}

$listeningFrontendPid = if ($frontendProc) { $frontendProc.Id } else { 0 }
try {
    $netConn3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($netConn3000 -and $netConn3000.OwningProcess -gt 0) { $listeningFrontendPid = $netConn3000.OwningProcess }
} catch {}
Write-Host "      [OK] Frontend ready on http://127.0.0.1:3000 (PID: $listeningFrontendPid)" -ForegroundColor Green

# Save PIDs
$pidInfo = @{
    backendPid = $listeningBackendPid
    backendCmdPid = if ($backendProc) { $backendProc.Id } else { $listeningBackendPid }
    frontendPid = $listeningFrontendPid
    frontendCmdPid = if ($frontendProc) { $frontendProc.Id } else { $listeningFrontendPid }
    backendPort = 5000
    frontendPort = 3000
    startedAt = (Get-Date).ToString("o")
    projectRoot = $resolvedRoot
}
$pidInfo | ConvertTo-Json | Set-Content -Path $pidFile -Force

# Step 4: Launch Default Browser
Write-Host "[4/4] Launching default browser..." -ForegroundColor Cyan
if (-not $NoBrowser) {
    Start-Process "http://127.0.0.1:3000"
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  ARCHORA ARCHITECTURE STUDIO IS ACTIVE" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  Local Studio URL:  http://127.0.0.1:3000" -ForegroundColor White
Write-Host "  Backend Service:   http://127.0.0.1:5000/api/health" -ForegroundColor Gray
Write-Host "  SQLite Database:   $resolvedRoot\data\archora.db" -ForegroundColor Gray
Write-Host ""

if ($Detach -or -not $Interactive) {
    Write-Host "  Archora is running in the background." -ForegroundColor Cyan
    Write-Host "  To stop Archora at any time, run 'stop-archora.bat'." -ForegroundColor Yellow
    Write-Host "==============================================================" -ForegroundColor Green
    exit 0
}

Write-Host "  Archora is running in interactive mode." -ForegroundColor Cyan
Write-Host "  Press [Q] or close this window to stop Archora." -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Green

while ($true) {
    Start-Sleep -Milliseconds 800
    
    # Check if user pressed 'q' (safely handle non-interactive/redirected consoles)
    try {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.KeyChar -eq 'q' -or $key.KeyChar -eq 'Q') {
                Write-Host "`nShutting down Archora Studio..." -ForegroundColor Yellow
                break
            }
        }
    } catch {}
    
    # Check if processes crashed
    $bp = Get-Process -Id $listeningBackendPid -ErrorAction SilentlyContinue
    $fp = Get-Process -Id $listeningFrontendPid -ErrorAction SilentlyContinue
    if (-not $bp -or -not $fp) {
        Write-Host "`n[NOTICE] One or more Archora services exited." -ForegroundColor Yellow
        break
    }
}

# Run shutdown logic cleanly
& "$PSScriptRoot\stop-archora.ps1" -ProjectRoot $resolvedRoot
exit 0
