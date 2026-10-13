using System;

internal static class UpdateCheck
{
    private static void Main()
    {
        var current = new Version(1, 1, 0, 0);
        const string valid = "{\"tag_name\":\"v1.2.0\",\"draft\":false,\"prerelease\":false,\"assets\":[{\"name\":\"SourceNote-Setup.exe\",\"state\":\"uploaded\",\"browser_download_url\":\"https://github.com/AliNajafpour/SourceNote/releases/download/v1.2.0/SourceNote-Setup.exe\"}]}";
        Check(Updates.NewerVersion(valid, current) == new Version(1, 2, 0, 0), "New installer release was missed");
        Check(Updates.NewerVersion(valid, new Version(1, 2, 0, 0)) == null, "Equal release was treated as newer");
        Check(Updates.NewerVersion(valid, new Version(2, 0, 0, 0)) == null, "Downgrade was offered");
        foreach (var invalid in new[] {
            valid.Replace("\"draft\":false", "\"draft\":true"),
            valid.Replace("\"prerelease\":false", "\"prerelease\":true"),
            valid.Replace("v1.2.0", "v1.2.0-beta"),
            valid.Replace("v1.2.0", "v999999999999.2.0"),
            valid.Replace("https://github.com/", "https://example.com/"),
            valid.Replace("AliNajafpour/SourceNote/", "someone/SourceNote/"),
            valid.Replace("SourceNote-Setup.exe", "SourceNote-Windows.zip"),
            valid.Replace("uploaded", "new"), "{}", "[]"
        }) Check(Updates.NewerVersion(invalid, current) == null, "Unsafe or incomplete release was accepted");
        bool rejected = false;
        try { Updates.NewerVersion("{broken", current); } catch (ArgumentException) { rejected = true; }
        Check(rejected, "Malformed response was accepted");
        Console.WriteLine("PASS: Update versions, downgrade prevention, stable releases, installer ownership, and incomplete responses.");
    }

    private static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
}
