param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot\..

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ARCHORA STUDIO - AUTOMATED GIT SYNC" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check if git repository exists
if (-not (Test-Path ".git")) {
    Write-Host "[ERROR] Not a git repository." -ForegroundColor Red
    exit 1
}

# 2. Check for changes
$status = git status --porcelain
if (-not $status) {
    Write-Host "[OK] Working tree clean. No changes to commit." -ForegroundColor Green
    exit 0
}

Write-Host "[Archora] Changes detected:" -ForegroundColor Yellow
$status | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }

# 3. Stage changes (respecting .gitignore: no .env, no data/*.db, no node_modules)
Write-Host "[Archora] Staging changes..." -ForegroundColor Cyan
git add .

# 4. Generate commit message if not provided
if (-not $Message) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $Message = "chore: auto-sync studio updates ($timestamp)"
}

Write-Host "[Archora] Committing with message: '$Message'..." -ForegroundColor Cyan
git commit -m $Message

# 5. Push to GitHub
Write-Host "[Archora] Pushing to GitHub (origin/main)..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Studio changes pushed to GitHub successfully!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to push to GitHub. Please check internet connection." -ForegroundColor Red
    exit 1
}
