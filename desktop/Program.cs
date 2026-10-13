using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new NoteWindow());
    }
}

internal sealed class NoteWindow : Form
{
    internal readonly WebView2 View = new WebView2();
    internal readonly TaskCompletionSource<bool> Ready = new TaskCompletionSource<bool>();
    private readonly string profile;
    private const string Origin = "https://app.sourcenote.local/";
    private readonly Timer updateTimer = new Timer { Interval = 6 * 60 * 60 * 1000 };
    private bool checkingUpdates;
    private Version notifiedVersion;
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);

    internal NoteWindow(string dataFolder = null)
    {
        Text = "SourceNote";
        ClientSize = new Size(1280, 800);
        MinimumSize = new Size(760, 560);
        StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi;
        BackColor = Color.FromArgb(247, 248, 250);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        profile = dataFolder ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SourceNote", "WebView2");
        updateTimer.Tick += async (sender, args) => await CheckForUpdates(false);
        FormClosed += (sender, args) => updateTimer.Dispose();
        View.Dock = DockStyle.Fill;
        Controls.Add(View);
        Shown += async (sender, args) => await Initialize();
    }

    private async Task Initialize()
    {
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, profile);
            await View.EnsureCoreWebView2Async(environment);
            var core = View.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("app.sourcenote.local", Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app"), CoreWebView2HostResourceAccessKind.Deny);
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.NavigationStarting += (sender, args) => { args.Cancel = !args.Uri.StartsWith(Origin, StringComparison.Ordinal); };
            core.NewWindowRequested += (sender, args) => { args.Handled = true; };
            core.PermissionRequested += (sender, args) => { args.State = CoreWebView2PermissionState.Deny; };
            core.DownloadStarting += SaveDownload;
            core.WebMessageReceived += async (sender, args) =>
            {
                if (!args.Source.StartsWith(Origin, StringComparison.Ordinal)) return;
                string message = args.TryGetWebMessageAsString();
                if (message == "import") await ChooseBackup();
                else if (message == "ready")
                {
                    var version = Assembly.GetExecutingAssembly().GetName().Version;
                    core.PostWebMessageAsJson(new JavaScriptSerializer().Serialize(new { type = "desktop-info", version = version.ToString(3) }));
                    if (profile == Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SourceNote", "WebView2"))
                    {
                        updateTimer.Start();
                        await CheckForUpdates(false);
                    }
                }
                else if (message == "check-updates") await CheckForUpdates(true);
                else if (message == "open-update")
                {
                    try { Process.Start(new ProcessStartInfo(Updates.Releases + "/latest") { UseShellExecute = true }); }
                    catch { MessageBox.Show(this, "Open " + Updates.Releases + "/latest in your browser to download the update.", "SourceNote", MessageBoxButtons.OK, MessageBoxIcon.Information); }
                }
                else if (message == "theme:dark" || message == "theme:light")
                {
                    int dark = message == "theme:dark" ? 1 : 0;
                    BackColor = dark == 1 ? Color.FromArgb(23, 27, 24) : Color.FromArgb(247, 248, 250);
                    if (DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int)) != 0) DwmSetWindowAttribute(Handle, 19, ref dark, sizeof(int));
                }
                else if (message == "import-error") MessageBox.Show(this, "The backup could not be imported. Your notes have not changed.", "SourceNote", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            };
            core.NavigationCompleted += (sender, args) =>
            {
                if (Ready.Task.IsCompleted) return;
                if (!args.IsSuccess) { Ready.TrySetException(new IOException("The app could not load: " + args.WebErrorStatus)); return; }
                Ready.TrySetResult(true);
            };
            core.Navigate(Origin + "index.html");
        }
        catch (Exception error)
        {
            Ready.TrySetException(error);
            MessageBox.Show(this, "SourceNote could not start. Make sure Microsoft Edge WebView2 Runtime is installed.\n\n" + error.Message, "SourceNote", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task CheckForUpdates(bool manual)
    {
        if (checkingUpdates) return;
        checkingUpdates = true;
        try
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            using (var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15), MaxResponseContentBufferSize = 1024 * 1024 })
            {
                var current = Assembly.GetExecutingAssembly().GetName().Version;
                client.DefaultRequestHeaders.UserAgent.ParseAdd("SourceNote/" + current.ToString(3));
                var latest = Updates.NewerVersion(await client.GetStringAsync(Updates.Api), current);
                if (IsDisposed) return;
                if (latest != null && (manual || latest != notifiedVersion))
                {
                    View.CoreWebView2.PostWebMessageAsJson(new JavaScriptSerializer().Serialize(new { type = "update", version = latest.ToString(3) }));
                    notifiedVersion = latest;
                }
                else if (manual && latest == null) MessageBox.Show(this, "You're using the latest available version of SourceNote.", "SourceNote " + current.ToString(3), MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
        catch
        {
            if (manual && !IsDisposed) MessageBox.Show(this, "Updates could not be checked. Check your internet connection and try again.", "SourceNote", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        finally { checkingUpdates = false; }
    }

    private void SaveDownload(object sender, CoreWebView2DownloadStartingEventArgs args)
    {
        using (var deferral = args.GetDeferral())
        using (var dialog = new SaveFileDialog { Filter = "Notes backup (*.json)|*.json", FileName = Path.GetFileName(args.ResultFilePath), DefaultExt = "json" })
        {
            args.Handled = true;
            if (dialog.ShowDialog(this) == DialogResult.OK) args.ResultFilePath = dialog.FileName;
            else args.Cancel = true;
        }
    }

    private async Task ChooseBackup()
    {
        using (var dialog = new OpenFileDialog { Filter = "Notes backup (*.json)|*.json", Title = "Import notes backup" })
        {
            if (dialog.ShowDialog(this) != DialogResult.OK) return;
            if (MessageBox.Show(this, "Replace the current notes with this backup? A copy of your current notes will be kept in the SourceNote backups folder.", "Import notes", MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return;
            try { await ImportBackup(dialog.FileName); }
            catch (Exception error) { MessageBox.Show(this, "The backup could not be imported.\n\n" + error.Message, "SourceNote", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        }
    }

    internal async Task ImportBackup(string path)
    {
        if (new FileInfo(path).Length > 20 * 1024 * 1024) throw new IOException("The backup is larger than 20 MB.");
        string raw = File.ReadAllText(path);
        string current = new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Deserialize<string>(await View.CoreWebView2.ExecuteScriptAsync("localStorage.getItem('sourcenote.v1')"));
        if (current != null)
        {
            string backups = Path.Combine(Path.GetDirectoryName(profile), "Backups");
            Directory.CreateDirectory(backups);
            File.WriteAllText(Path.Combine(backups, "notes-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N") + ".json"), current);
        }
        View.CoreWebView2.PostWebMessageAsString(raw);
    }
}
