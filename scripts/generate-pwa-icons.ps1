param([string]$PublicDir = "$PSScriptRoot\..\public")

Add-Type -AssemblyName System.Drawing

$resolvedDir = [System.IO.Path]::GetFullPath($PublicDir)
if (-not (Test-Path $resolvedDir)) {
    New-Item -ItemType Directory -Path $resolvedDir -Force | Out-Null
}

function Generate-ArchoraPng {
    param(
        [int]$sz,
        [string]$outputPath,
        [bool]$isMaskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $bgColor = [System.Drawing.Color]::FromArgb(243, 229, 207) # Archora Parchment #F3E5CF
    $espresso = [System.Drawing.Color]::FromArgb(72, 42, 24)    # Archora Espresso #482A18
    $amber = [System.Drawing.Color]::FromArgb(180, 83, 9)       # Warm Bronze / Keystone Accent

    if ($isMaskable) {
        # Maskable icon requires solid background edge-to-edge
        $g.Clear($bgColor)
        $innerScale = [float]($sz * 0.70) / 64.0
        $offsetX = [float]($sz * 0.15)
        $offsetY = [float]($sz * 0.15)
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
        # Rounded tile background
        $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
        $borderPen = New-Object System.Drawing.Pen($espresso, [Math]::Max(1.5, [float]($sz / 64.0) * 1.5))
        
        $pad = [float]($sz * 0.04)
        $width = [float]($sz - (2.0 * $pad))
        $radius = [float]($sz * 0.18)

        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc($pad, $pad, $radius * 2.0, $radius * 2.0, 180.0, 90.0)
        $path.AddArc($pad + $width - ($radius * 2.0), $pad, $radius * 2.0, $radius * 2.0, 270.0, 90.0)
        $path.AddArc($pad + $width - ($radius * 2.0), $pad + $width - ($radius * 2.0), $radius * 2.0, $radius * 2.0, 0.0, 90.0)
        $path.AddArc($pad, $pad + $width - ($radius * 2.0), $radius * 2.0, $radius * 2.0, 90.0, 90.0)
        $path.CloseFigure()

        $g.FillPath($bgBrush, $path)
        $g.DrawPath($borderPen, $path)

        $innerScale = [float]($sz * 0.76) / 64.0
        $offsetX = [float]($sz * 0.12)
        $offsetY = [float]($sz * 0.12)
    }

    $scale = $innerScale
    $outerPen = New-Object System.Drawing.Pen($espresso, [Math]::Max(2.0, 4.2 * $scale))
    $outerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $outerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $innerPen = New-Object System.Drawing.Pen($espresso, [Math]::Max(1.5, 2.5 * $scale))
    $innerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $innerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $basePen = New-Object System.Drawing.Pen($espresso, [Math]::Max(2.0, 4.0 * $scale))
    $basePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $basePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Base plinth
    $g.DrawLine($basePen, $offsetX + [float](10.0 * $scale), $offsetY + [float](53.0 * $scale), $offsetX + [float](54.0 * $scale), $offsetY + [float](53.0 * $scale))

    # Outer Arch
    $g.DrawLine($outerPen, $offsetX + [float](14.0 * $scale), $offsetY + [float](53.0 * $scale), $offsetX + [float](14.0 * $scale), $offsetY + [float](26.0 * $scale))
    $g.DrawLine($outerPen, $offsetX + [float](50.0 * $scale), $offsetY + [float](53.0 * $scale), $offsetX + [float](50.0 * $scale), $offsetY + [float](26.0 * $scale))
    $g.DrawArc($outerPen, $offsetX + [float](14.0 * $scale), $offsetY + [float](8.0 * $scale), [float](36.0 * $scale), [float](36.0 * $scale), 180.0, 180.0)

    # Inner Arch
    $g.DrawLine($innerPen, $offsetX + [float](23.0 * $scale), $offsetY + [float](53.0 * $scale), $offsetX + [float](23.0 * $scale), $offsetY + [float](26.0 * $scale))
    $g.DrawLine($innerPen, $offsetX + [float](41.0 * $scale), $offsetY + [float](53.0 * $scale), $offsetX + [float](41.0 * $scale), $offsetY + [float](26.0 * $scale))
    $g.DrawArc($innerPen, $offsetX + [float](23.0 * $scale), $offsetY + [float](17.0 * $scale), [float](18.0 * $scale), [float](18.0 * $scale), 180.0, 180.0)

    # Keystone Accent
    $keystoneBrush = New-Object System.Drawing.SolidBrush($amber)
    $g.FillRectangle($keystoneBrush, $offsetX + [float](30.0 * $scale), $offsetY + [float](10.0 * $scale), [float](4.0 * $scale), [float](7.0 * $scale))

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "[OK] Generated: $outputPath ($sz x $sz)" -ForegroundColor Green
}

Generate-ArchoraPng -sz 192 -outputPath "$resolvedDir\pwa-192x192.png" -isMaskable $false
Generate-ArchoraPng -sz 512 -outputPath "$resolvedDir\pwa-512x512.png" -isMaskable $false
Generate-ArchoraPng -sz 512 -outputPath "$resolvedDir\pwa-maskable-512x512.png" -isMaskable $true
Generate-ArchoraPng -sz 180 -outputPath "$resolvedDir\apple-touch-icon.png" -isMaskable $false

