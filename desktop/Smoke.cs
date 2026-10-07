using System;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

internal static class Smoke
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string output = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "desktop", "test-output"));
        Directory.CreateDirectory(output);
        var form = new NoteWindow(Path.Combine(output, "profile-" + Guid.NewGuid().ToString("N")));
        form.ShowInTaskbar = false;
        form.Shown += async (sender, args) =>
        {
            try
            {
                await form.Ready.Task;
                await RunScript(form, @"
                    if (document.querySelector('#board').children.length < 4) throw Error('App did not render');
                    if (document.querySelector('#import').hidden) throw Error('Desktop import is unavailable');
                    const toggle = document.querySelector('#theme-toggle');
                    if (!toggle) throw Error('Theme toggle is unavailable');
                    if (document.documentElement.dataset.theme === 'dark') toggle.click();
                    await document.fonts.ready;
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                ");
                using (var image = File.Create(Path.Combine(output, "light-mode.png"))) await form.View.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                await RunScript(form, @"
                    const toggle = document.querySelector('#theme-toggle');
                    toggle.click();
                    if (document.documentElement.dataset.theme !== 'dark' || toggle.getAttribute('aria-pressed') !== 'true') throw Error('Dark mode did not activate');
                    if (getComputedStyle(document.documentElement).colorScheme !== 'dark') throw Error('Native controls did not switch to dark mode');
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                ");
                using (var image = File.Create(Path.Combine(output, "dark-mode.png"))) await form.View.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                await RunScript(form, @"
                    document.querySelector('#add-general-checklist').click();
                    const source = [...document.querySelectorAll('.note[data-id]')].at(-1);
                    const title = source.querySelector('.note-title'); title.value = 'Windows test'; title.dispatchEvent(new Event('input'));
                    const item = source.querySelector('.check-text'); item.value = 'Persistent desktop task'; item.dispatchEvent(new Event('input'));
                    const { dateKey } = await import('./model.mjs');
                    const date = source.querySelector('input[type=date]'); date.value = dateKey(new Date()); date.dispatchEvent(new Event('change'));
                    const scheduled = document.querySelector('#scheduled-tasks input[type=checkbox]');
                    if (!scheduled) throw Error('Scheduled task was not rendered');
                    scheduled.click();
                    if (!document.querySelector('.note[aria-label=""Windows test""] input[type=checkbox]').checked) throw Error('Completion did not sync');
                ");
                var reloaded = new TaskCompletionSource<bool>();
                EventHandler<CoreWebView2NavigationCompletedEventArgs> reload = (s, e) => reloaded.TrySetResult(e.IsSuccess);
                form.View.CoreWebView2.NavigationCompleted += reload;
                form.View.CoreWebView2.Reload();
                if (!await reloaded.Task) throw new Exception("Reload failed");
                form.View.CoreWebView2.NavigationCompleted -= reload;
                await RunScript(form, @"
                    if (!document.querySelector('#scheduled-tasks input[type=checkbox]')?.checked) throw Error('Notes did not persist after reload');
                    if (document.documentElement.dataset.theme !== 'dark') throw Error('Theme preference did not persist');
                    document.querySelector('#theme-toggle').click();
                    if (document.documentElement.dataset.theme !== 'light') throw Error('Light mode could not be restored');
                ");
                string previous = Json.Deserialize<string>(await form.View.CoreWebView2.ExecuteScriptAsync("localStorage.getItem('sourcenote.v1')"));
                string backup = Path.Combine(output, "import.json");
                File.WriteAllText(backup, "{\"version\":1,\"notes\":[{\"id\":\"import-test\",\"date\":null,\"title\":\"Imported notes\",\"body\":\"Local Windows app\",\"color\":\"green\",\"kind\":\"note\",\"items\":[]}]}");
                var imported = new TaskCompletionSource<bool>();
                EventHandler<CoreWebView2WebMessageReceivedEventArgs> receive = (s, e) => { if (e.TryGetWebMessageAsString() == "imported") imported.TrySetResult(true); };
                form.View.CoreWebView2.WebMessageReceived += receive;
                await form.ImportBackup(backup);
                await imported.Task;
                form.View.CoreWebView2.WebMessageReceived -= receive;
                await RunScript(form, @"
                    if (document.querySelectorAll('.note[data-id]').length !== 1 || !document.querySelector('.note[aria-label=""Imported notes""]')) throw Error('Backup import failed');
                ");
                string[] backups = Directory.GetFiles(Path.Combine(output, "Backups"), "*.json");
                if (backups.Length == 0 || File.ReadAllText(backups[backups.Length - 1]) != previous) throw new Exception("Previous notes were not backed up");
                await RunScript(form, "document.querySelector('#theme-toggle').click();");
                using (var image = File.Create(Path.Combine(output, "dark-preview.png"))) await form.View.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
                File.WriteAllText(Path.Combine(output, "result.txt"), "PASS: Native Windows startup, offline UI, scheduled tasks, completion sync, storage, backup import, and persistent dark/light mode.");
                Environment.ExitCode = 0;
            }
            catch (Exception error)
            {
                File.WriteAllText(Path.Combine(output, "result.txt"), "FAIL: " + error);
                Environment.ExitCode = 1;
            }
            finally { form.Close(); }
        };
        Application.Run(form);
    }

    private static async Task RunScript(NoteWindow form, string script)
    {
        string token = Guid.NewGuid().ToString("N");
        var completed = new TaskCompletionSource<string>();
        EventHandler<CoreWebView2WebMessageReceivedEventArgs> handler = (sender, args) =>
        {
            string value = args.TryGetWebMessageAsString();
            if (value.StartsWith(token + ":")) completed.TrySetResult(value.Substring(token.Length + 1));
        };
        form.View.CoreWebView2.WebMessageReceived += handler;
        try
        {
            await form.View.CoreWebView2.ExecuteScriptAsync("(async () => { try { " + script + "; chrome.webview.postMessage('" + token + ":ok'); } catch (error) { chrome.webview.postMessage('" + token + ":' + error.message); } })()");
            string result = await completed.Task;
            if (result != "ok") throw new Exception(result);
        }
        finally { form.View.CoreWebView2.WebMessageReceived -= handler; }
    }
}
