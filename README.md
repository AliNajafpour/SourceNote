# SourceNote

A personal daily planner with sticky notes, checklists, and tasks assigned to dates. Built for Windows, with an English interface and light and dark themes.

[Download for Windows](https://github.com/AliNajafpour/SourceNote/releases/latest) · [Report an issue](https://github.com/AliNajafpour/SourceNote/issues)

![SourceNote in light mode](docs/light-mode.png)

## Install on Windows

1. Open the [latest release](https://github.com/AliNajafpour/SourceNote/releases/latest).
2. Under **Assets**, download **SourceNote-Setup.exe**.
3. Close any running SourceNote window, then run the setup file.
4. Open **SourceNote** from the Start menu. A desktop shortcut is optional during setup.

Setup installs for your Windows account under `%LOCALAPPDATA%\Programs\SourceNote`, normally `C:\Users\<you>\AppData\Local\Programs\SourceNote`. It creates the Start menu shortcut with the app icon and an entry in Windows **Installed apps**. No administrator password, account, Node.js, or web server is needed.

Requires **64-bit Windows 10 or 11**, [.NET Framework 4.8](https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48), and [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). Setup checks for these prerequisites before installing. If WebView2 is missing, install Microsoft's **x64 Evergreen Runtime** and run setup again. The installer and note board work offline when these prerequisites are present.

The app and setup file are unsigned, so Windows may display a publisher warning. Release downloads include `SHA256SUMS.txt`; check a setup download in PowerShell with `Get-FileHash .\SourceNote-Setup.exe -Algorithm SHA256`.

### Update

SourceNote checks GitHub for a newer stable release when it opens and every six hours while running. A small notification appears when a newer Windows installer is available. Click **Get update** to open the release page, download **SourceNote-Setup.exe**, close SourceNote, and run setup. It upgrades the same folder and preserves your notes and backups. Updates are installed only when you choose to run setup.

The refresh button at the bottom of the calendar checks manually; the adjacent label shows the installed version. Offline checks fail quietly and do not affect your notes. Checking updates sends a request to GitHub for public release metadata; it does not send your notes.

Before updating, export a backup. To move from the old portable release, close it and run setup. Your existing Windows notes are picked up automatically because the data folder stays the same. Replace any old pinned `SourceNote.exe` entry with the installed **SourceNote** shortcut once.

### Uninstall or use the portable version

Uninstall through Windows **Settings → Apps → Installed apps → SourceNote**. Uninstall removes the program and its installer-created shortcuts; it retains notes and backups in `%LOCALAPPDATA%\SourceNote`.

For a portable copy, download **SourceNote-Windows.zip**, extract the entire ZIP, and open **SourceNote.exe**. Keep the `app` folder and DLLs beside it. Update a portable copy by extracting a newer ZIP into a new folder. Close the previous copy before opening the new one. Windows portable and installed copies share the same notes folder.

## How to use

### Choose a day

Click a date in the left sidebar. Use the arrows above it to change months, or **Today** to return to the current day. Dots indicate dates with notes or scheduled tasks.

### Add notes and checklists

Each creation button has two sections: the main section creates a note; the smaller checklist icon creates a checklist.

| Button | What it creates |
| --- | --- |
| **New note** | A general note, visible on every day |
| Checklist icon beside **New note** | A general checklist, visible on every day |
| **Today note** / **Day note** | A note belonging to the selected date |
| Checklist icon beside **Today note** / **Day note** | A checklist belonging to the selected date |

Click a note's title or body to edit it. Changes save automatically. In a checklist, click **Add item** or press **Enter** while editing an item to add another; **Shift+Enter** inserts a line break. Tick a checkbox to complete a task.

### Schedule individual tasks

Click the calendar beside a checklist item and choose a date. You can also drag an item's grip onto a date in the sidebar.

That task appears in **Scheduled tasks** on its assigned date, even when its original checklist belongs to another day. Completing it updates the original item too. Click the checklist name under a scheduled task to open its source. Use the calendar control to change the date or **Clear date** to remove it.

### Organize the board

- Use the minus button to minimize a note; the chevron restores it.
- Drag a note's grip to reorder cards, or use **Move earlier** / **Move later** in its **…** menu.
- The **…** menu also changes color, duplicates notes, and deletes them. **Undo** restores the most recently deleted note during the current session.
- Search filters the selected day's board, including general notes and scheduled tasks.
- Use the grid/list buttons to change the layout.
- Use the moon/sun button to switch themes. The first launch follows your system theme; your choice is saved, including the Windows title bar.
- **Alt+N** creates a general note. **Esc** closes open note menus and dismisses the status message.

![SourceNote in dark mode](docs/dark-mode.png)

## Saving and backups

The Windows app works offline. Notes stay on your device; there is no account or cloud sync.

- **Download icon:** export all notes and scheduled task dates to a JSON backup.
- **Upload icon in the Windows app:** import a SourceNote JSON backup. Import replaces the current notes after confirmation. The app validates the file and keeps a copy of the previous notes before importing.
- Windows data: `%LOCALAPPDATA%\SourceNote\WebView2`.
- Copies saved before imports: `%LOCALAPPDATA%\SourceNote\Backups`.

Keep exported backups somewhere safe. Deleting the Windows data folder removes the app's local notes. Theme preferences are separate from note backups.

To move notes from the browser version, export them there and import the JSON into the Windows app. Each browser origin/profile and the Windows app have separate storage.

## Run the browser version

Install [Node.js](https://nodejs.org/) **22 or newer**, then:

```sh
git clone https://github.com/AliNajafpour/SourceNote.git
cd SourceNote
npm start
```

Open [http://127.0.0.1:5180](http://127.0.0.1:5180). No npm dependencies need installing. Keep the server running while using the browser version.

Browser notes save in that browser's local storage. Clearing site data removes them. The browser can export backups; backup import is available in the Windows app. The first launch includes four editable example notes.

## Build and test

The interface uses HTML, CSS, and JavaScript. The Windows host uses WinForms and Microsoft Edge WebView2.

```sh
npm test
```

On 64-bit Windows with .NET Framework 4.8 and Node.js 22 or newer:

```sh
npm run build:windows
npm run test:windows
npm run build:installer
npm run test:installer
```

The first desktop build downloads Microsoft's pinned WebView2 SDK from NuGet. Output is `dist/SourceNote/SourceNote.exe` and `dist/SourceNote-Windows.zip`. The native test requires the WebView2 Runtime and uses an isolated profile. It checks scheduling, storage, backups, themes, release validation, and update notifications.

The installer build downloads the checksum-verified Inno Setup 6.7.3 compiler into `desktop/vendor/inno`. Output is `dist/SourceNote-Setup.exe`. Installer verification uses a unique test app registration and folder; it checks installation, upgrading, shortcuts, downgrade prevention, and uninstall behavior without using your notes profile.

GitHub Actions runs model and installer checks and builds both Windows downloads on pushes and pull requests. To ship a release, update `package.json` and the changelog, then push a matching tag such as `v1.1.0`. CI rejects tags that differ from the package version and publishes the setup file, portable ZIP, and SHA-256 checksums. Existing installations detect the new release during their next update check. The native UI check runs locally.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| App reports a missing WebView2 Runtime | Install the x64 Evergreen runtime linked above. |
| App will not open or reports missing DLLs | Extract the entire ZIP and keep all bundled files together. |
| Notes are missing after switching versions | Browser and Windows storage are separate. Export from the original version and import into Windows. |
| Changes are not saved | Use the download button to export a backup, then check available disk space and access to the data folder. |
| Browser server reports the port is in use | Close the previous SourceNote server before running `npm start` again. |

Include your Windows version and the error message when [reporting a problem](https://github.com/AliNajafpour/SourceNote/issues).

## Support SourceNote

If SourceNote is useful to you, you can support it by starring the repository, sharing feedback, or contributing a pull request. Donations are optional and help me make more time to work on the app.

| Network | Donation address |
| --- | --- |
| Ethereum / Base / BNB Smart Chain / Polygon | `0x68096867CBa03B7ce9C76480FE556bC80C1b855D` |
| Bitcoin | `bc1qu7htee5vpyqalvwkk38nelwxrx8j9jfukuefqv` |
| Solana | `3MBgXWQUY39JYHNByr9A8sswvd12Pzn8tYxtHb9MiiF8` |

Choose the matching network when sending a donation.
