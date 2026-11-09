param(
    [string]$ProjectRoot = "$PSScriptRoot\.."
)

$ErrorActionPreference = "Stop"

$cleanRoot = if ($ProjectRoot) { $ProjectRoot.Trim('"', "'", "`t", " ") } else { "$PSScriptRoot\.." }
$resolvedRoot = [System.IO.Path]::GetFullPath($cleanRoot)
Set-Location $resolvedRoot

Write-Host "==============================================================" -ForegroundColor DarkYellow
Write-Host "  ARCHORA STUDIO - WINDOWS ENVIRONMENT SETUP" -ForegroundColor Yellow
Write-Host "  Target Project: $resolvedRoot" -ForegroundColor Gray
Write-Host "==============================================================" -ForegroundColor DarkYellow
Write-Host ""

# 1. Check Node.js and npm
Write-Host "[1/7] Checking Node.js and npm runtime..." -ForegroundColor Cyan
try {
    $nodeVersion = node -v
    Write-Host "      [OK] Node.js is installed: $nodeVersion" -ForegroundColor Green
    
    $nodeMajor = [int]($nodeVersion.TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 18) {
        Write-Warning "Node.js version 18 or higher is recommended. Detected: $nodeVersion"
    }
} catch {
    Write-Host "      [ERROR] Node.js is not found in PATH." -ForegroundColor Red
    Write-Host "      Please install Node.js (v18+) from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

try {
    $npmVersion = npm -v
    Write-Host "      [OK] npm is installed: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "      [ERROR] npm is not found in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check and Preserve .env Configuration
Write-Host "`n[2/7] Verifying environment configuration..." -ForegroundColor Cyan
$envPath = Join-Path $resolvedRoot ".env"
$envExamplePath = Join-Path $resolvedRoot ".env.example"

if (Test-Path $envPath) {
    Write-Host "      [OK] Existing configuration detected (.env preserved, never overwritten)." -ForegroundColor Green
} elseif (Test-Path $envExamplePath) {
    Copy-Item $envExamplePath $envPath
    Write-Host "      [OK] Created initial .env from template (.env.example)." -ForegroundColor Green
} else {
    Write-Warning "      Neither .env nor .env.example found. Default loopback configuration will be used."
}

# Check Gemini Key without revealing it
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    $geminiLine = $envContent | Where-Object { $_ -match "^\s*GEMINI_API_KEY\s*=\s*(.+)$" }
    if ($geminiLine) {
        $rawKey = ($geminiLine -split "=", 2)[1].Trim().Trim('"').Trim("'")
        if ($rawKey -and $rawKey -ne "YOUR_GEMINI_API_KEY_HERE" -and $rawKey.Length -ge 10) {
            $maskedKey = $rawKey.Substring(0, 3) + "..." + $rawKey.Substring($rawKey.Length - 3, 3)
            Write-Host "      [OK] Gemini API Key configured: $maskedKey (length: $($rawKey.Length) chars)" -ForegroundColor Green
        } else {
            Write-Host "      [NOTE] Gemini API Key not yet configured in .env." -ForegroundColor Yellow
            Write-Host "             Get a free key at https://aistudio.google.com/ and paste into .env" -ForegroundColor Gray
        }
    }
}

# 3. Verify Application Storage Directories (Drive D: to prevent writing to full Drive C:)
Write-Host "`n[3/7] Verifying persistent application storage on Drive D:..." -ForegroundColor Cyan
$archoraRoot = Join-Path $cleanRoot "data"
$archoraData = $archoraRoot
$archoraUploads = Join-Path $archoraRoot "uploads"
$archoraBackups = Join-Path $archoraRoot "backups"
$archoraTemp = Join-Path $archoraRoot "temp"
$archoraRuntime = Join-Path $archoraRoot "runtime"

foreach ($dir in @($archoraData, $archoraUploads, $archoraBackups, $archoraTemp, $archoraRuntime)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "      [CREATED] Storage directory: $dir" -ForegroundColor Gray
    }
}
Write-Host "      [OK] Persistent storage ready on Drive D: at $archoraRoot" -ForegroundColor Green

# 4. Verify Project Dependencies
Write-Host "`n[4/7] Verifying project dependencies..." -ForegroundColor Cyan
$nodeModulesPath = Join-Path $resolvedRoot "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "      Installing project dependencies via npm install (this may take a moment)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      [ERROR] npm install failed with exit code $LASTEXITCODE." -ForegroundColor Red
        exit 1
    }
    Write-Host "      [OK] Dependencies installed successfully." -ForegroundColor Green
} else {
    Write-Host "      [OK] node_modules directory verified." -ForegroundColor Green
}

# 5. Generate Application Icons
Write-Host "`n[5/7] Verifying Archora application icons..." -ForegroundColor Cyan
$icoPath = Join-Path $resolvedRoot "public\arch-icon.ico"
$iconScript = Join-Path $resolvedRoot "scripts\generateIcon.ps1"
if (Test-Path $iconScript) {
    & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $iconScript -icoPath $icoPath | Out-Null
    $faviconPath = Join-Path $resolvedRoot "public\favicon.ico"
    Copy-Item $icoPath $faviconPath -Force
    Write-Host "      [OK] High-resolution application icon generated: $icoPath" -ForegroundColor Green
}

# 6. Verify Production Build
Write-Host "`n[6/7] Verifying frontend and backend build..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "      [ERROR] Build verification failed." -ForegroundColor Red
    exit 1
}
Write-Host "      [OK] Frontend and backend builds verified successfully." -ForegroundColor Green

# 7. Create Windows Desktop Shortcut
Write-Host "`n[7/7] Creating Archora Windows Desktop shortcut..." -ForegroundColor Cyan
$shortcutScript = Join-Path $resolvedRoot "scripts\create-shortcut.ps1"
if (Test-Path $shortcutScript) {
    & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $shortcutScript -ProjectRoot $resolvedRoot
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  ARCHORA WINDOWS SETUP COMPLETE!" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  How to start Archora:" -ForegroundColor Cyan
Write-Host "  1. Double-click the 'Archora' shortcut on your Desktop." -ForegroundColor White
Write-Host "     - OR - run 'start-archora.bat' in this folder." -ForegroundColor White
Write-Host ""
Write-Host "  How to stop Archora:" -ForegroundColor Cyan
Write-Host "  1. Run 'stop-archora.bat' in this folder." -ForegroundColor White
Write-Host "==============================================================" -ForegroundColor Green
exit 0

