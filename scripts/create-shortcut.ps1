param(
    [string]$ProjectRoot = "$PSScriptRoot\..",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

try {
    $cleanRoot = if ($ProjectRoot) { $ProjectRoot.Trim('"', "'", "`t", " ") } else { "$PSScriptRoot\.." }
    $resolvedRoot = [System.IO.Path]::GetFullPath($cleanRoot)
    $targetBat = [System.IO.Path]::Combine($resolvedRoot, "start-archora.bat")
    $icoPath = [System.IO.Path]::Combine($resolvedRoot, "public", "arch-icon.ico")
    
    # Ensure icon exists if generateIcon script is available
    if (-not (Test-Path $icoPath)) {
        $iconScript = [System.IO.Path]::Combine($resolvedRoot, "scripts", "generateIcon.ps1")
        if (Test-Path $iconScript) {
            & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $iconScript -icoPath $icoPath | Out-Null
        }
    }
    
    # Find all desktop directories on this Windows PC (handles OneDrive redirection & local Desktop)
    $desktopCandidates = @(
        [System.Environment]::GetFolderPath('Desktop'),
        [System.Environment]::GetFolderPath('CommonDesktopDirectory'),
        (Join-Path $env:USERPROFILE "Desktop"),
        (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
        (Join-Path $env:USERPROFILE "OneDrive\Apps\Desktop")
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

    if ($desktopCandidates.Count -eq 0) {
        $desktopCandidates = @([System.Environment]::GetFolderPath('Desktop'))
    }

    $wsh = New-Object -ComObject WScript.Shell
    $createdCount = 0
    $primaryShortcut = ""

    foreach ($desk in $desktopCandidates) {
        try {
            # 1. Standard Archora desktop shortcut
            $shortcutPath = [System.IO.Path]::Combine($desk, "Archora.lnk")
            $shortcut = $wsh.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $targetBat
            $shortcut.Arguments = ""
            $shortcut.WorkingDirectory = $resolvedRoot
            $shortcut.Description = "Archora - AI Architecture Workspace"
            $shortcut.WindowStyle = 1
            if (Test-Path $icoPath) {
                $shortcut.IconLocation = "$icoPath,0"
            }
            $shortcut.Save()
            $createdCount++
            if (-not $primaryShortcut) { $primaryShortcut = $shortcutPath }

            # 2. Update any other Archora shortcuts on this desktop (e.g. Edge PWA shortcuts)
            $otherShortcuts = Get-ChildItem -Path $desk -Filter "*Archora*.lnk" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -ne $shortcutPath }
            foreach ($other in $otherShortcuts) {
                try {
                    $otherSc = $wsh.CreateShortcut($other.FullName)
                    $otherSc.TargetPath = $targetBat
                    $otherSc.Arguments = ""
                    $otherSc.WorkingDirectory = $resolvedRoot
                    $otherSc.Description = "Archora - AI Architecture Workspace"
                    $otherSc.WindowStyle = 1
                    if (Test-Path $icoPath) {
                        $otherSc.IconLocation = "$icoPath,0"
                    }
                    $otherSc.Save()
                } catch {}
            }
        } catch {
            # Continue to other desktop paths
        }
    }

    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wsh) | Out-Null
    
    Write-Host "[OK] Desktop shortcut created successfully ($createdCount location(s)):" -ForegroundColor Green
    Write-Host "     Shortcut: $primaryShortcut" -ForegroundColor Cyan
    Write-Host "     Target:   $targetBat" -ForegroundColor Gray
    Write-Host "     WorkDir:  $resolvedRoot" -ForegroundColor Gray
    if (Test-Path $icoPath) {
        Write-Host "     Icon:     $icoPath" -ForegroundColor Gray
    }
    exit 0
} catch {
    Write-Host "[ERROR] Failed to create desktop shortcut: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
