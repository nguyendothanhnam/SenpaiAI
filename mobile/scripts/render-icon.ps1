# Render the repository-native vector design with Windows' existing GDI+.
# No dependency is added to the React Native application.
Add-Type -AssemblyName System.Drawing
$assetFolder = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\assets'))
$bitmap = [Drawing.Bitmap]::new(1024, 1024)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$orange = [Drawing.ColorTranslator]::FromHtml('#ea580c')
$amber = [Drawing.ColorTranslator]::FromHtml('#f59e0b')
$gradient = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Rectangle]::new(0,0,1024,1024),$orange,$amber,45)
$graphics.FillRectangle($gradient,0,0,1024,1024)
$graphics.FillEllipse([Drawing.Brushes]::White,430,152,164,164)
$left = [Drawing.Drawing2D.GraphicsPath]::new()
$left.AddBezier(200,330,290,300,380,300,482,365)
$left.AddLine(482,365,482,775)
$left.AddBezier(482,775,350,700,280,710,200,740)
$left.CloseFigure()
$right = [Drawing.Drawing2D.GraphicsPath]::new()
$right.AddBezier(542,365,640,300,730,300,824,330)
$right.AddLine(824,330,824,740)
$right.AddBezier(824,740,740,710,670,700,542,775)
$right.CloseFigure()
$graphics.FillPath([Drawing.Brushes]::White,$left)
$graphics.FillPath([Drawing.Brushes]::White,$right)
$pen = [Drawing.Pen]::new([Drawing.Color]::White,16)
$pen.StartCap = [Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($pen,512,378,512,778)
$linePen = [Drawing.Pen]::new($orange,17)
$linePen.StartCap = [Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($linePen,260,435,420,472)
$graphics.DrawLine($linePen,260,515,420,552)
$graphics.DrawLine($linePen,604,472,764,435)
$graphics.DrawLine($linePen,604,552,764,515)
$bitmap.Save((Join-Path $assetFolder 'icon.png'),[Drawing.Imaging.ImageFormat]::Png)
$linePen.Dispose(); $pen.Dispose(); $left.Dispose(); $right.Dispose(); $gradient.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
Write-Output 'Rendered assets/icon.png (1024 x 1024).'
