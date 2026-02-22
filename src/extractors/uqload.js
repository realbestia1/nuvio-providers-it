const { USER_AGENT } = require('./common');

async function extractUqload(url, refererBase = 'https://uqload.io/') {
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
    const regex = /sources: \["(.*?)"\]/;
    const match = regex.exec(html);
    if (match) {
      let streamUrl = match[1];
      if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
      return {
        url: streamUrl,
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://uqload.io/"
        }
      };
    }
    return null;
  } catch (e) {
    console.error("[Extractors] Uqload extraction error:", e);
    return null;
  }
}

module.exports = { extractUqload };
