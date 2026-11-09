param(
    [int]$IntervalSeconds = 5
)

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot\..

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ARCHORA STUDIO - AUTOMATIC GITHUB WATCHER" -ForegroundColor Cyan
Write-Host "  Watching for workspace modifications..." -ForegroundColor Green
Write-Host "  Press Ctrl + C to stop watcher." -ForegroundColor Gray
Write-Host "==================================================" -ForegroundColor Cyan

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    
    $status = git status --porcelain 2>$null
    if ($status) {
        Write-Host "`n[Auto-Sync] Detected file changes at $(Get-Date -Format 'HH:mm:ss')..." -ForegroundColor Yellow
        $status | Select-Object -First 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        
        # Debounce wait for editor writes to finish
        Start-Sleep -Seconds 3
        
        git add .
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $commitMsg = "auto: update workspace files ($timestamp)"
        
        $commitResult = git commit -m $commitMsg 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[Auto-Sync] Changes committed. Pushing to GitHub..." -ForegroundColor Cyan
            git push origin main
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[Auto-Sync] Successfully synced with GitHub!" -ForegroundColor Green
            } else {
                Write-Host "[Auto-Sync] Push deferred (connection error or retry needed)." -ForegroundColor Magenta
            }
        }
    }
}

