$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $PSScriptRoot 'vendor/inno/ISCC.exe'
$testId = 'SourceNote.InstallerTest.' + [Guid]::NewGuid().ToString('N')
$testName = 'SourceNote Installer Test ' + $testId.Substring($testId.Length - 8)
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "test-output/$testId"))
$installDir = Join-Path $testRoot 'installed'
$fixtureDir = Join-Path $testRoot 'previous'
$currentVersion = (Get-Content "$projectDir/package.json" -Raw | ConvertFrom-Json).version
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
Copy-Item -LiteralPath "$projectDir/dist/SourceNote" -Destination $fixtureDir -Recurse
$previousSource = Join-Path $testRoot 'Previous.cs'
$previousExe = Join-Path $fixtureDir 'SourceNote.exe'
'[assembly:System.Reflection.AssemblyFileVersion("1.0.0.0")] internal class Previous { static void Main() {} }' | Set-Content $previousSource
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe "/out:$previousExe" $previousSource
if ($LASTEXITCODE -ne 0) { throw 'Previous-version fixture failed.' }
foreach ($build in @(@('1.0.0',$fixtureDir,'previous-setup'), @($currentVersion,"$projectDir/dist/SourceNote",'current-setup'))) {
    & $compiler /Q "/DAppVersion=$($build[0])" "/DSourceDir=$($build[1])" "/DSetupId=$testId" "/DAppName=$testName" "/O$testRoot" "/F$($build[2])" (Join-Path $PSScriptRoot 'SourceNote.iss')
    if ($LASTEXITCODE -ne 0) { throw 'Test installer compilation failed.' }
}
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\${testId}_is1"
function Run-TestSetup([string]$path, [bool]$shouldFail = $false) {
    $run = Start-Process -FilePath $path -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-',"/DIR=`"$installDir`"",'/TASKS=',"/LOG=`"$testRoot/setup.log`"") -WindowStyle Hidden -PassThru
    if (!$run.WaitForExit(60000)) { $run.Kill(); throw 'Test installer timed out.' }
    if (($run.ExitCode -ne 0) -ne $shouldFail) { throw "Unexpected setup result: $($run.ExitCode)" }
}
Run-TestSetup "$testRoot/previous-setup.exe"
if ((Get-ItemProperty $uninstallKey).DisplayVersion -ne '1.0.0') { throw 'Initial registration failed.' }
'keep this local file' | Set-Content "$installDir/preserved.txt"
Run-TestSetup "$testRoot/current-setup.exe"
if ((Get-ItemProperty $uninstallKey).DisplayVersion -ne $currentVersion) { throw 'Upgrade registration failed.' }
if ([System.Diagnostics.FileVersionInfo]::GetVersionInfo("$installDir/SourceNote.exe").FileVersion -ne "$currentVersion.0") { throw 'Installed executable did not upgrade.' }
if (!(Test-Path "$installDir/app/app.mjs") -or (Get-Content "$installDir/preserved.txt" -Raw).Trim() -ne 'keep this local file') { throw 'Upgrade lost files.' }
$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) "$testName.lnk"
$shortcut = $shell.CreateShortcut($shortcutPath)
if ($shortcut.TargetPath -ne "$installDir\SourceNote.exe" -or $shortcut.IconLocation -ne "$installDir\SourceNote.exe,0") { throw 'Installed shortcut target/icon is wrong.' }
Run-TestSetup "$testRoot/previous-setup.exe" $true
if ((Get-ItemProperty $uninstallKey).DisplayVersion -ne $currentVersion) { throw 'Older installer changed the installed version.' }
$checkedInstallDir = [System.IO.Path]::GetFullPath($installDir)
if (!$checkedInstallDir.StartsWith([System.IO.Path]::GetFullPath($testRoot) + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe uninstall test path.' }
$uninstall = Start-Process -FilePath "$installDir/unins000.exe" -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -WindowStyle Hidden -PassThru
if (!$uninstall.WaitForExit(60000)) { $uninstall.Kill(); throw 'Test uninstaller timed out.' }
if ($uninstall.ExitCode -ne 0 -or (Test-Path $uninstallKey) -or (Test-Path $shortcutPath) -or (Test-Path "$installDir/SourceNote.exe")) { throw 'Uninstall did not remove the test installation.' }
if (!(Test-Path "$installDir/preserved.txt")) { throw 'Uninstall removed an untracked local file.' }
Write-Output 'PASS: Clean install, same-location upgrade, version registration, shortcut icon, downgrade rejection, and uninstall preservation.'
