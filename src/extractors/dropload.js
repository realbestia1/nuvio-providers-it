const { USER_AGENT, unPack } = require('./common');

async function extractDropLoad(url, refererBase = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    if (!refererBase) refererBase = new URL(url).origin + "/";
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const regex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = regex.exec(html);
    if (match) {
      const p = match[1];
      const a = parseInt(match[2]);
      const c = parseInt(match[3]);
      const k = match[4].split("|");
      const unpacked = unPack(p, a, c, k, null, {});
      const fileMatch = unpacked.match(/file:"(.*?)"/);
      if (fileMatch) {
        let streamUrl = fileMatch[1];
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        const referer = new URL(url).origin + "/";
        return {
          url: streamUrl,
          headers: {
            "User-Agent": USER_AGENT,
            "Referer": referer
          }
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[Extractors] DropLoad extraction error:", e);
    return null;
  }
}

module.exports = { extractDropLoad };
