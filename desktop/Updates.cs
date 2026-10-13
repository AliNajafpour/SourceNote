using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

internal static class Updates
{
    internal const string Releases = "https://github.com/AliNajafpour/SourceNote/releases";
    internal const string Api = "https://api.github.com/repos/AliNajafpour/SourceNote/releases/latest";

    internal static Version NewerVersion(string json, Version current)
    {
        var release = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 }.DeserializeObject(json) as Dictionary<string, object>;
        if (release == null || !release.ContainsKey("draft") || !false.Equals(release["draft"]) ||
            !release.ContainsKey("prerelease") || !false.Equals(release["prerelease"]) || !release.ContainsKey("tag_name")) return null;
        string tag = release["tag_name"] as string;
        Version version;
        if (tag == null || !Regex.IsMatch(tag, @"^v[0-9]+\.[0-9]+\.[0-9]+$") ||
            !Version.TryParse(tag.Substring(1) + ".0", out version) || version <= current) return null;
        object assets;
        if (!release.TryGetValue("assets", out assets) || !(assets is object[])) return null;
        foreach (object entry in (object[])assets)
        {
            var asset = entry as Dictionary<string, object>;
            if (asset != null && asset.ContainsKey("name") && "SourceNote-Setup.exe".Equals(asset["name"]) &&
                asset.ContainsKey("state") && "uploaded".Equals(asset["state"]) && asset.ContainsKey("browser_download_url") &&
                (Releases + "/download/" + tag + "/SourceNote-Setup.exe").Equals(asset["browser_download_url"])) return version;
        }
        return null;
    }
}
