const { USER_AGENT, unPack } = require('./common');

async function extractMixDrop(url, refererBase = 'https://m1xdrop.net/') {
  try {
    if (url.startsWith("//")) url = "https:" + url;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": refererBase
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\),(\d+),(\{\})\)\)/;
    const match = packedRegex.exec(html);
    if (match) {
      const p = match[1];
      const a = parseInt(match[2]);
      const c = parseInt(match[3]);
      const k = match[4].split("|");
      const unpacked = unPack(p, a, c, k, null, {});
      const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
      if (wurlMatch) {
        let streamUrl = wurlMatch[1];
        if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
        return {
          url: streamUrl,
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': 'https://m1xdrop.net/',
            'Origin': 'https://m1xdrop.net'
          }
        };
      }
    }
    return null;
  } catch (e) {
    console.error("[Extractors] MixDrop extraction error:", e);
    return null;
  }
}

module.exports = { extractMixDrop };
