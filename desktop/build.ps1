$ErrorActionPreference = 'Stop'
$desktopDir = $PSScriptRoot
$projectDir = Split-Path $PSScriptRoot -Parent
$packageDir = Join-Path $PSScriptRoot 'vendor/webview2'
$releaseDir = Join-Path $projectDir 'dist/SourceNote'
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path "$packageDir/lib/net462/Microsoft.Web.WebView2.Core.dll")) {
    New-Item -ItemType Directory -Force -Path "$PSScriptRoot/vendor" | Out-Null
    Invoke-WebRequest 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4258.31/microsoft.web.webview2.1.0.4258.31.nupkg' -OutFile "$PSScriptRoot/vendor/webview2.zip"
    Expand-Archive "$PSScriptRoot/vendor/webview2.zip" $packageDir -Force
}
if (!(Test-Path $compilerPath)) { throw '.NET Framework compiler is required to build SourceNote.' }
New-Item -ItemType Directory -Force -Path "$releaseDir/app" | Out-Null
Copy-Item "$packageDir/lib/net462/Microsoft.Web.WebView2.Core.dll", "$packageDir/lib/net462/Microsoft.Web.WebView2.WinForms.dll", "$packageDir/runtimes/win-x64/native/WebView2Loader.dll" -Destination $releaseDir
Copy-Item (Join-Path $packageDir 'LICENSE.txt') -Destination "$releaseDir/WebView2-LICENSE.txt"
foreach ($file in 'index.html','styles.css','app.mjs','model.mjs','favicon.svg') { Copy-Item (Join-Path $projectDir $file) "$releaseDir/app/$file" }

# Reuse the note mark for the executable and taskbar icon.
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new(64, 64)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = 'AntiAlias'
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#dce6ac'))
$pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#36412d'), 3)
$points = [System.Drawing.Point[]]@([System.Drawing.Point]::new(18,18), [System.Drawing.Point]::new(46,18), [System.Drawing.Point]::new(46,40), [System.Drawing.Point]::new(38,48), [System.Drawing.Point]::new(18,48), [System.Drawing.Point]::new(18,18))
$graphics.DrawLines($pen, $points)
$graphics.DrawLine($pen, 38,48,38,40)
$graphics.DrawLine($pen, 38,40,46,40)
$graphics.DrawLine($pen, 25,26,38,26)
$graphics.DrawLine($pen, 25,34,33,34)
$iconPath = Join-Path $desktopDir 'SourceNote.ico'
$iconHandle = $bitmap.GetHicon()
$nativeIcon = [System.Drawing.Icon]::FromHandle($iconHandle)
$iconStream = [System.IO.File]::Create($iconPath)
$nativeIcon.Save($iconStream)
$iconStream.Dispose()
$nativeIcon.Dispose()
$graphics.Dispose()
$pen.Dispose()
$bitmap.Dispose()

$sourcePath = Join-Path $desktopDir 'Program.cs'
$manifestPath = Join-Path $desktopDir 'app.manifest'
& $compilerPath /nologo /target:winexe /platform:x64 /optimize+ "/out:$releaseDir/SourceNote.exe" "/win32icon:$iconPath" "/win32manifest:$manifestPath" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/reference:$releaseDir/Microsoft.Web.WebView2.Core.dll" "/reference:$releaseDir/Microsoft.Web.WebView2.WinForms.dll" $sourcePath
if ($LASTEXITCODE -ne 0) { throw 'Windows app compilation failed.' }
@'
SourceNote for Windows

Extract this whole folder and open SourceNote.exe. Keep the app folder and DLLs beside the executable.
Your notes save in %LOCALAPPDATA%\SourceNote\WebView2 and remain when the app folder is moved or updated.
Use the upload button to import a browser JSON backup. Before importing, current notes are copied to %LOCALAPPDATA%\SourceNote\Backups.
Use the download button to export a backup.
Requires 64-bit Windows 10/11 with Microsoft Edge WebView2 Runtime and .NET Framework 4.8.
WebView2 Runtime: https://developer.microsoft.com/microsoft-edge/webview2/
'@ | Set-Content "$releaseDir/README.txt"
Compress-Archive -Path "$releaseDir/SourceNote.exe", "$releaseDir/app", "$releaseDir/Microsoft.Web.WebView2.Core.dll", "$releaseDir/Microsoft.Web.WebView2.WinForms.dll", "$releaseDir/WebView2Loader.dll", "$releaseDir/README.txt", "$releaseDir/WebView2-LICENSE.txt" -DestinationPath "$projectDir/dist/SourceNote-Windows.zip" -Force
Write-Output "Built $releaseDir/SourceNote.exe"
