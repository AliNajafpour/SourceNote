$ErrorActionPreference = 'Stop'
$desktopDir = $PSScriptRoot
$releaseDir = Join-Path (Split-Path $desktopDir -Parent) 'dist/SourceNote'
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$verifyExe = Join-Path $releaseDir 'SourceNote.Verify.exe'
& $compilerPath /nologo /target:winexe /platform:x64 /main:Smoke "/out:$verifyExe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/reference:$releaseDir/Microsoft.Web.WebView2.Core.dll" "/reference:$releaseDir/Microsoft.Web.WebView2.WinForms.dll" (Join-Path $desktopDir 'Program.cs') (Join-Path $desktopDir 'Smoke.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native check compilation failed.' }
$process = Start-Process -FilePath $verifyExe -WindowStyle Hidden -PassThru
if (!$process.WaitForExit(60000)) { $process.Kill(); throw 'Native app check timed out.' }
$result = Get-Content "$desktopDir/test-output/result.txt" -Raw
Write-Output $result
Remove-Item -LiteralPath $verifyExe
if ($process.ExitCode -ne 0 -or !$result.StartsWith('PASS:')) { throw 'Native app check failed.' }
