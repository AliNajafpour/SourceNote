#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef SourceDir
  #define SourceDir "..\dist\SourceNote"
#endif
#ifndef AppName
  #define AppName "SourceNote"
#endif
#ifndef SetupId
  #define SetupId "AliNajafpour.SourceNote"
#endif

[Setup]
AppId={#SetupId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Ali Najafpour
AppPublisherURL=https://github.com/AliNajafpour/SourceNote
AppSupportURL=https://github.com/AliNajafpour/SourceNote/issues
AppUpdatesURL=https://github.com/AliNajafpour/SourceNote/releases/latest
DefaultDirName={localappdata}\Programs\SourceNote
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir=..\dist
OutputBaseFilename=SourceNote-Setup
SetupIconFile=SourceNote.ico
UninstallDisplayIcon={app}\SourceNote.exe
VersionInfoVersion={#AppVersion}.0
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "{#SourceDir}\SourceNote.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\*.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\WebView2-LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\{#AppName}"; Filename: "{app}\SourceNote.exe"; WorkingDir: "{app}"; IconFilename: "{app}\SourceNote.exe"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\SourceNote.exe"; WorkingDir: "{app}"; IconFilename: "{app}\SourceNote.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\SourceNote.exe"; Description: "Open SourceNote"; Flags: nowait postinstall skipifsilent

[Code]
function RuntimeAt(Root: Integer): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(Root, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and
            (Version <> '') and (Version <> '0.0.0.0');
end;

function HasWebViewRuntime: Boolean;
begin
  Result := RuntimeAt(HKLM32) or RuntimeAt(HKCU);
end;

function InitializeSetup: Boolean;
begin
  Result := IsDotNetInstalled(net48, 0);
  if not Result then SuppressibleMsgBox('SourceNote requires .NET Framework 4.8. Install it from https://dotnet.microsoft.com/download/dotnet-framework/net48 and run Setup again.', mbError, MB_OK, IDOK);
  if Result then begin
    Result := HasWebViewRuntime;
    if not Result then SuppressibleMsgBox('SourceNote requires Microsoft Edge WebView2 Runtime. Install the x64 Evergreen Runtime from https://developer.microsoft.com/microsoft-edge/webview2/ and run Setup again.', mbError, MB_OK, IDOK);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExistingVersion: String;
  Existing, Incoming: Int64;
begin
  Result := '';
  if GetVersionNumbersString(ExpandConstant('{app}\SourceNote.exe'), ExistingVersion) and
     StrToVersion(ExistingVersion, Existing) and StrToVersion('{#AppVersion}', Incoming) and
     (ComparePackedVersion(Existing, Incoming) > 0) then begin
    Result := 'A newer SourceNote version is already installed.';
    Exit;
  end;
end;
