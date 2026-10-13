$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
$vendorDir = Join-Path $PSScriptRoot 'vendor'
$innoDir = Join-Path $vendorDir 'inno'
$compiler = Join-Path $innoDir 'ISCC.exe'
New-Item -ItemType Directory -Force -Path $vendorDir | Out-Null
if (!(Test-Path -LiteralPath $compiler)) {
    $innoSetup = Join-Path $vendorDir 'innosetup-6.7.3.exe'
    Invoke-WebRequest 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe' -OutFile $innoSetup -TimeoutSec 120
    $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    $downloadStream = [System.IO.File]::OpenRead($innoSetup)
    try { $downloadHash = [BitConverter]::ToString($hashAlgorithm.ComputeHash($downloadStream)).Replace('-','').ToLowerInvariant() }
    finally { $downloadStream.Dispose(); $hashAlgorithm.Dispose() }
    if ($downloadHash -ne '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732') { throw 'Inno Setup download checksum mismatch.' }
    $install = Start-Process -FilePath $innoSetup -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-','/CURRENTUSER','/NOICONS',"/DIR=`"$innoDir`"") -WindowStyle Hidden -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw 'Inno Setup compiler installation failed.' }
}
$appVersion = (Get-Content (Join-Path $projectDir 'package.json') -Raw | ConvertFrom-Json).version
if (!(Test-Path "$projectDir/dist/SourceNote/SourceNote.exe")) { throw 'Run npm run build:windows first.' }
if ([System.Diagnostics.FileVersionInfo]::GetVersionInfo("$projectDir/dist/SourceNote/SourceNote.exe").FileVersion -ne "$appVersion.0") { throw 'Desktop build version differs from package.json. Run npm run build:windows again.' }
& $compiler "/DAppVersion=$appVersion" (Join-Path $PSScriptRoot 'SourceNote.iss')
if ($LASTEXITCODE -ne 0) { throw 'Windows installer compilation failed.' }
