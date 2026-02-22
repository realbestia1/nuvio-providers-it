const { USER_AGENT, unPack } = require('./common');

async function extractSuperVideo(url, refererBase = null) {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    if (!refererBase) refererBase = new URL(url).origin + "/";
    let directUrl = url.replace("/e/", "/").replace("/embed-", "/");
    let response = await fetch(directUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    let html = await response.text();
    if (html.includes("This video can be watched as embed only")) {
      let embedUrl = url;
      if (!embedUrl.includes("/e/") && !embedUrl.includes("/embed-")) {
        embedUrl = directUrl.replace(".cc/", ".cc/e/");
      }
      response = await fetch(embedUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": refererBase
        }
      });
      html = await response.text();
    }
    if (html.includes("Cloudflare") || response.status === 403) {
      return null;
    }
    const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = packedRegex.exec(html);
    if (match) {
      const p = match[1];
      const a = parseInt(match[2]);
      const c = parseInt(match[3]);
      const k = match[4].split("|");
      const unpacked = unPack(p, a, c, k, null, {});
      const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
      if (fileMatch) {
        let streamUrl = fileMatch[1];
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        return streamUrl;
      }
    }
    return null;
  } catch (e) {
    console.error("[Extractors] SuperVideo extraction error:", e);
    return null;
  }
}

module.exports = { extractSuperVideo };
