# Draws the Baby Chicken Empire app icon (an isometric grass block) at the sizes the PWA needs.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Draw-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 27, 36, 48))
  $s = $size / 100.0
  function P($x, $y) { New-Object System.Drawing.PointF ([float]($x * $s)), ([float]($y * $s)) }
  $top   = @((P 50 18), (P 80 34), (P 50 50), (P 20 34))
  $left  = @((P 20 34), (P 50 50), (P 50 84), (P 20 68))
  $right = @((P 50 50), (P 80 34), (P 80 68), (P 50 84))
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 108, 178, 70))), $top)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 122, 84, 52))), $left)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 96, 64, 40))), $right)
  # grass lip on the sides
  $lipL = @((P 20 34), (P 50 50), (P 50 57), (P 20 41))
  $lipR = @((P 50 50), (P 80 34), (P 80 41), (P 50 57))
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 84, 146, 54))), $lipL)
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 70, 124, 46))), $lipR)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 0, 0, 0)), ([float](1.2 * $s))
  $g.DrawPolygon($pen, $top); $g.DrawPolygon($pen, $left); $g.DrawPolygon($pen, $right)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 192 (Join-Path $out 'icon-192.png')
Draw-Icon 512 (Join-Path $out 'icon-512.png')
Draw-Icon 180 (Join-Path $out 'apple-touch-icon.png')
Write-Output "Icons written to $out"
