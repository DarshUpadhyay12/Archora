param([string]$icoPath = "$PSScriptRoot\..\public\arch-icon.ico")

Add-Type -AssemblyName System.Drawing

$targetSizes = @(256, 128, 64, 48, 32, 16)
$pngEntries = @()

foreach ($sz in $targetSizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $scale = [float]$sz / 64.0
    
    # Background rounded plinth tile (Warm Parchment #FAF4EA)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 244, 234))
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(72, 42, 24), [Math]::Max(1.0, 1.8 * $scale))
    
    $pad = [float](2.0 * $scale)
    $width = [float]($sz - (2.0 * $pad))
    $radius = [float](10.0 * $scale)
    
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($pad, $pad, $radius * 2.0, $radius * 2.0, 180.0, 90.0)
    $path.AddArc($pad + $width - ($radius * 2.0), $pad, $radius * 2.0, $radius * 2.0, 270.0, 90.0)
    $path.AddArc($pad + $width - ($radius * 2.0), $pad + $width - ($radius * 2.0), $radius * 2.0, $radius * 2.0, 0.0, 90.0)
    $path.AddArc($pad, $pad + $width - ($radius * 2.0), $radius * 2.0, $radius * 2.0, 90.0, 90.0)
    $path.CloseFigure()
    
    $g.FillPath($bgBrush, $path)
    $g.DrawPath($borderPen, $path)
    
    # Architectural Espresso Arch Lines (#482A18)
    $espresso = [System.Drawing.Color]::FromArgb(72, 42, 24)
    $outerPen = New-Object System.Drawing.Pen($espresso, [Math]::Max(1.5, 4.2 * $scale))
    $outerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $outerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    $innerPen = New-Object System.Drawing.Pen($espresso, [Math]::Max(1.0, 2.5 * $scale))
    $innerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $innerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    # Base plinth
    $basePen = New-Object System.Drawing.Pen($espresso, [Math]::Max(1.5, 3.8 * $scale))
    $basePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $basePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($basePen, [float](10.0 * $scale), [float](53.0 * $scale), [float](54.0 * $scale), [float](53.0 * $scale))
    
    # Outer Arch (x: 14 to 50, center 32, radius 18, top 8 to 26, legs down to 53)
    $g.DrawLine($outerPen, [float](14.0 * $scale), [float](53.0 * $scale), [float](14.0 * $scale), [float](26.0 * $scale))
    $g.DrawLine($outerPen, [float](50.0 * $scale), [float](53.0 * $scale), [float](50.0 * $scale), [float](26.0 * $scale))
    $g.DrawArc($outerPen, [float](14.0 * $scale), [float](8.0 * $scale), [float](36.0 * $scale), [float](36.0 * $scale), 180.0, 180.0)
    
    # Inner Arch (x: 23 to 41, center 32, radius 9, top 17 to 26, legs down to 53)
    $g.DrawLine($innerPen, [float](23.0 * $scale), [float](53.0 * $scale), [float](23.0 * $scale), [float](26.0 * $scale))
    $g.DrawLine($innerPen, [float](41.0 * $scale), [float](53.0 * $scale), [float](41.0 * $scale), [float](26.0 * $scale))
    $g.DrawArc($innerPen, [float](23.0 * $scale), [float](17.0 * $scale), [float](18.0 * $scale), [float](18.0 * $scale), 180.0, 180.0)
    
    # Keystone Accent (#B45309 Warm Bronze / Amber)
    $keystoneBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 83, 9))
    $g.FillRectangle($keystoneBrush, [float](30.0 * $scale), [float](10.0 * $scale), [float](4.0 * $scale), [float](7.0 * $scale))
    
    # Save as PNG memory stream
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngEntries += ,@($sz, $ms.ToArray())
    
    $g.Dispose()
    $bmp.Dispose()
}

$fullIcoPath = [System.IO.Path]::GetFullPath($icoPath)
$icoDir = [System.IO.Path]::GetDirectoryName($fullIcoPath)
if (-not (Test-Path $icoDir)) {
    New-Item -ItemType Directory -Path $icoDir -Force | Out-Null
}

$fs = [System.IO.File]::Create($fullIcoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header: Reserved (0), Type (1 = ICO), Count (N)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$pngEntries.Count)

$offset = 6 + (16 * $pngEntries.Count)
foreach ($item in $pngEntries) {
    $sz = $item[0]
    $bytes = $item[1]
    
    $w = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { 0 } else { [byte]$sz }
    
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)
    
    $offset += $bytes.Length
}

foreach ($item in $pngEntries) {
    $bw.Write($item[1])
}

$bw.Close()
$fs.Close()
Write-Host "Created Archora ICO icon: $fullIcoPath ($($pngEntries.Count) resolutions)"
