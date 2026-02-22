var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/extractors/common.js
var require_common = __commonJS({
  "src/extractors/common.js"(exports2, module2) {
    var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function unPack(p, a, c, k, e, d) {
      e = function(c2) {
        return (c2 < a ? "" : e(parseInt(c2 / a))) + ((c2 = c2 % a) > 35 ? String.fromCharCode(c2 + 29) : c2.toString(36));
      };
      if (!"".replace(/^/, String)) {
        while (c--) {
          d[e(c)] = k[c] || e(c);
        }
        k = [function(e2) {
          return d[e2] || e2;
        }];
        e = function() {
          return "\\w+";
        };
        c = 1;
      }
      while (c--) {
        if (k[c]) {
          p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
        }
      }
      return p;
    }
    module2.exports = {
      USER_AGENT,
      unPack
    };
  }
});

// src/extractors/mixdrop.js
var require_mixdrop = __commonJS({
  "src/extractors/mixdrop.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractMixDrop2(url, refererBase = "https://m1xdrop.net/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
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
                  "User-Agent": USER_AGENT,
                  "Referer": "https://m1xdrop.net/",
                  "Origin": "https://m1xdrop.net"
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] MixDrop extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractMixDrop: extractMixDrop2 };
  }
});

// src/extractors/dropload.js
var require_dropload = __commonJS({
  "src/extractors/dropload.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractDropLoad2(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          if (!refererBase) refererBase = new URL(url).origin + "/";
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
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
      });
    }
    module2.exports = { extractDropLoad: extractDropLoad2 };
  }
});

// src/extractors/supervideo.js
var require_supervideo = __commonJS({
  "src/extractors/supervideo.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractSuperVideo2(url, refererBase = null) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          if (!refererBase) refererBase = new URL(url).origin + "/";
          let directUrl = url.replace("/e/", "/").replace("/embed-", "/");
          let response = yield fetch(directUrl, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          let html = yield response.text();
          if (html.includes("This video can be watched as embed only")) {
            let embedUrl = url;
            if (!embedUrl.includes("/e/") && !embedUrl.includes("/embed-")) {
              embedUrl = directUrl.replace(".cc/", ".cc/e/");
            }
            response = yield fetch(embedUrl, {
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": refererBase
              }
            });
            html = yield response.text();
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
      });
    }
    module2.exports = { extractSuperVideo: extractSuperVideo2 };
  }
});

// src/extractors/streamtape.js
var require_streamtape = __commonJS({
  "src/extractors/streamtape.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    function extractStreamTape(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const html = yield response.text();
          const match = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = '(.*?)'/);
          if (match) {
            let link = match[1];
            const lineMatch = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = (.*);/);
            if (lineMatch) {
              const raw = lineMatch[1];
              const cleanLink = raw.replace(/['"\+\s]/g, "");
              if (cleanLink.startsWith("//")) return "https:" + cleanLink;
              if (cleanLink.startsWith("http")) return cleanLink;
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] StreamTape extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractStreamTape };
  }
});

// src/extractors/uqload.js
var require_uqload = __commonJS({
  "src/extractors/uqload.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    function extractUqload2(url, refererBase = "https://uqload.io/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
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
      });
    }
    module2.exports = { extractUqload: extractUqload2 };
  }
});

// src/extractors/upstream.js
var require_upstream = __commonJS({
  "src/extractors/upstream.js"(exports2, module2) {
    var { USER_AGENT, unPack } = require_common();
    function extractUpstream2(url, refererBase = "https://upstream.to/") {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": refererBase
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
          const match = packedRegex.exec(html);
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
              return {
                url: streamUrl,
                headers: {
                  "User-Agent": USER_AGENT,
                  "Referer": "https://upstream.to/"
                }
              };
            }
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Upstream extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractUpstream: extractUpstream2 };
  }
});

// src/extractors/vidoza.js
var require_vidoza = __commonJS({
  "src/extractors/vidoza.js"(exports2, module2) {
    function extractVidoza(url) {
      return __async(this, null, function* () {
        try {
          if (url.startsWith("//")) url = "https:" + url;
          const response = yield fetch(url);
          if (!response.ok) return null;
          const html = yield response.text();
          let match = html.match(/sources:\s*\[\s*\{\s*file:\s*"(.*?)"/);
          if (!match) {
            match = html.match(/source src="(.*?)"/);
          }
          if (match) {
            let streamUrl = match[1];
            if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
            return streamUrl;
          }
          return null;
        } catch (e) {
          console.error("[Extractors] Vidoza extraction error:", e);
          return null;
        }
      });
    }
    module2.exports = { extractVidoza };
  }
});

// src/extractors/vixcloud.js
var require_vixcloud = __commonJS({
  "src/extractors/vixcloud.js"(exports2, module2) {
    var { USER_AGENT } = require_common();
    function extractVixCloud(url) {
      return __async(this, null, function* () {
        try {
          const response = yield fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": "https://www.animeunity.so/"
            }
          });
          if (!response.ok) return null;
          const html = yield response.text();
          const streams = [];
          const downloadRegex = /window\.downloadUrl\s*=\s*'([^']+)'/;
          const downloadMatch = downloadRegex.exec(html);
          if (downloadMatch) {
            const downloadUrl = downloadMatch[1];
            let quality = "Unknown";
            if (downloadUrl.includes("1080p")) quality = "1080p";
            else if (downloadUrl.includes("720p")) quality = "720p";
            else if (downloadUrl.includes("480p")) quality = "480p";
            else if (downloadUrl.includes("360p")) quality = "360p";
            streams.push({
              url: downloadUrl,
              quality,
              type: "direct",
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://vixcloud.co/"
              }
            });
          }
          const tokenRegex = /'token':\s*'(\w+)'/;
          const expiresRegex = /'expires':\s*'(\d+)'/;
          const urlRegex = /url:\s*'([^']+)'/;
          const fhdRegex = /window\.canPlayFHD\s*=\s*true/;
          const tokenMatch = tokenRegex.exec(html);
          const expiresMatch = expiresRegex.exec(html);
          const urlMatch = urlRegex.exec(html);
          const fhdMatch = fhdRegex.test(html);
          if (tokenMatch && expiresMatch && urlMatch) {
            const token = tokenMatch[1];
            const expires = expiresMatch[1];
            let serverUrl = urlMatch[1];
            let finalUrl = "";
            if (serverUrl.includes("?b=1")) {
              finalUrl = `${serverUrl}&token=${token}&expires=${expires}`;
            } else {
              finalUrl = `${serverUrl}?token=${token}&expires=${expires}`;
            }
            if (fhdMatch) {
              finalUrl += "&h=1";
            }
            const parts = finalUrl.split("?");
            finalUrl = parts[0] + ".m3u8";
            if (parts.length > 1) {
              finalUrl += "?" + parts.slice(1).join("?");
            }
            streams.push({
              url: finalUrl,
              quality: "Auto",
              type: "m3u8",
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": "https://vixcloud.co/"
              }
            });
          }
          return streams;
        } catch (e) {
          console.error("[VixCloud] Extraction error:", e);
          return [];
        }
      });
    }
    module2.exports = { extractVixCloud };
  }
});

// src/extractors/index.js
var require_extractors = __commonJS({
  "src/extractors/index.js"(exports2, module2) {
    var { extractMixDrop: extractMixDrop2 } = require_mixdrop();
    var { extractDropLoad: extractDropLoad2 } = require_dropload();
    var { extractSuperVideo: extractSuperVideo2 } = require_supervideo();
    var { extractStreamTape } = require_streamtape();
    var { extractUqload: extractUqload2 } = require_uqload();
    var { extractUpstream: extractUpstream2 } = require_upstream();
    var { extractVidoza } = require_vidoza();
    var { extractVixCloud } = require_vixcloud();
    var { USER_AGENT, unPack } = require_common();
    module2.exports = {
      extractMixDrop: extractMixDrop2,
      extractDropLoad: extractDropLoad2,
      extractSuperVideo: extractSuperVideo2,
      extractStreamTape,
      extractUqload: extractUqload2,
      extractUpstream: extractUpstream2,
      extractVidoza,
      extractVixCloud,
      USER_AGENT,
      unPack
    };
  }
});

// src/guardaserie/index.js
var __async2 = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var BASE_URL = "https://guardaserietv.best";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var { extractMixDrop, extractDropLoad, extractSuperVideo, extractUqload, extractUpstream } = require_extractors();
function getQualityFromName(qualityStr) {
  if (!qualityStr) return "Unknown";
  const quality = qualityStr.toUpperCase();
  if (quality === "ORG" || quality === "ORIGINAL") return "Original";
  if (quality === "4K" || quality === "2160P") return "4K";
  if (quality === "1440P" || quality === "2K") return "1440p";
  if (quality === "1080P" || quality === "FHD") return "1080p";
  if (quality === "720P" || quality === "HD") return "720p";
  if (quality === "480P" || quality === "SD") return "480p";
  if (quality === "360P") return "360p";
  if (quality === "240P") return "240p";
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return "4K";
    if (resolution >= 1440) return "1440p";
    if (resolution >= 1080) return "1080p";
    if (resolution >= 720) return "720p";
    if (resolution >= 480) return "480p";
    if (resolution >= 360) return "360p";
    return "240p";
  }
  return "Unknown";
}
function getShowInfo(tmdbId, type) {
  return __async2(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      console.error("[Guardaserie] TMDB error:", e);
      return null;
    }
  });
}
function getTmdbIdFromImdb(imdbId, type) {
  return __async2(this, null, function* () {
    var _a, _b;
    try {
      const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (type === "movie" && ((_a = data.movie_results) == null ? void 0 : _a.length) > 0) return data.movie_results[0].id;
      if (type === "tv" && ((_b = data.tv_results) == null ? void 0 : _b.length) > 0) return data.tv_results[0].id;
      return null;
    } catch (e) {
      console.error("[Guardaserie] ID conversion error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async2(this, null, function* () {
    if (String(type).toLowerCase() === "movie") return [];
    try {
      let tmdbId = id;
      if (id.toString().startsWith("tt")) {
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[Guardaserie] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }
      let showInfo = null;
      try {
        showInfo = yield getShowInfo(tmdbId, type);
      } catch (e) {
        console.error("[Guardaserie] Error fetching show info:", e);
      }
      if (!showInfo) return [];
      const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title || "Serie TV";
      const year = showInfo.first_air_date ? showInfo.first_air_date.split("-")[0] : "";
      console.log(`[Guardaserie] Searching for: ${title} (${year})`);
      const params = new URLSearchParams();
      params.append("do", "search");
      params.append("subaction", "search");
      params.append("story", title);
      const searchUrl = `${BASE_URL}/index.php?${params.toString()}`;
      const searchResponse = yield fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": BASE_URL
        }
      });
      const searchHtml = yield searchResponse.text();
      const resultRegex = /<div class="mlnh-2">\s*<h2>\s*<a href="([^"]+)" title="([^"]+)">[\s\S]*?<\/div>\s*<div class="mlnh-3 hdn">([^<]*)<\/div>/g;
      let match;
      let showUrl = null;
      const metaYear = year ? parseInt(year) : null;
      const candidates = [];
      while ((match = resultRegex.exec(searchHtml)) !== null) {
        const foundUrl = match[1];
        const foundTitle = match[2];
        const foundYearStr = match[3];
        if (foundTitle.toLowerCase().includes(title.toLowerCase())) {
          candidates.push({
            url: foundUrl,
            title: foundTitle,
            year: foundYearStr
          });
        }
      }
      let showHtml = null;
      for (const candidate of candidates) {
        let matchesYear = true;
        if (metaYear) {
          const yearMatch = candidate.year.match(/(\d{4})/);
          if (yearMatch) {
            const foundYear = parseInt(yearMatch[1]);
            if (Math.abs(foundYear - metaYear) > 2) {
              matchesYear = false;
            }
          }
        }
        if (matchesYear) {
          console.log(`[Guardaserie] Verifying candidate: ${candidate.title} (${candidate.year})`);
          try {
            const candidateRes = yield fetch(candidate.url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL
              }
            });
            if (!candidateRes.ok) continue;
            const candidateHtml = yield candidateRes.text();
            if (id.toString().startsWith("tt")) {
              const imdbMatches = candidateHtml.match(/tt\d{7,8}/g);
              if (imdbMatches && imdbMatches.length > 0) {
                const targetId = id.toString();
                const hasTarget = imdbMatches.includes(targetId);
                const otherIds = imdbMatches.filter((m) => m !== targetId);
                if (!hasTarget && otherIds.length > 0) {
                  console.log(`[Guardaserie] Rejected ${candidate.url} due to IMDb mismatch. Found: ${otherIds.join(", ")}`);
                  continue;
                }
                if (hasTarget) {
                  console.log(`[Guardaserie] Verified ${candidate.url} with IMDb match.`);
                }
              }
            }
            showUrl = candidate.url;
            showHtml = candidateHtml;
            break;
          } catch (e) {
            console.error(`[Guardaserie] Error verifying candidate ${candidate.url}:`, e);
          }
        }
      }
      if (!showUrl && candidates.length > 0) {
        console.log("[Guardaserie] No candidate matched criteria.");
      }
      if (!showUrl || !showHtml) {
        console.log("[Guardaserie] Show not found");
        return [];
      }
      console.log(`[Guardaserie] Found show URL: ${showUrl}`);
      const episodeStr = `${season}x${episode}`;
      const episodeRegex = new RegExp(`data-num="${episodeStr}"`, "i");
      const episodeMatch = episodeRegex.exec(showHtml);
      if (!episodeMatch) {
        console.log(`[Guardaserie] Episode ${episodeStr} not found`);
        return [];
      }
      const searchFromIndex = episodeMatch.index;
      const mirrorsStartIndex = showHtml.indexOf('<div class="mirrors">', searchFromIndex);
      if (mirrorsStartIndex === -1) {
        console.log("[Guardaserie] Mirrors div not found");
        return [];
      }
      const mirrorsEndIndex = showHtml.indexOf("</div>", mirrorsStartIndex);
      const mirrorsHtml = showHtml.substring(mirrorsStartIndex, mirrorsEndIndex);
      const linkRegex = /data-link="([^"]+)"/g;
      const links = [];
      let linkMatch;
      while ((linkMatch = linkRegex.exec(mirrorsHtml)) !== null) {
        links.push(linkMatch[1]);
      }
      console.log(`[Guardaserie] Found ${links.length} potential links`);
      const streamPromises = links.map((link) => __async2(null, null, function* () {
        try {
          let streamUrl = null;
          let playerName = "Unknown";
          if (link.includes("dropload")) {
            const extracted = yield extractDropLoad(link);
            if (extracted && extracted.url) {
              let quality = "HD";
              const lowerUrl = extracted.url.toLowerCase();
              if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
              else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
              else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
              else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
              else if (lowerUrl.includes("360")) quality = "360p";
              const normalizedQuality = getQualityFromName(quality);
              const displayName = `${title} ${season}x${episode}`;
              return {
                url: extracted.url,
                headers: extracted.headers,
                name: `Guardaserie - DropLoad`,
                title: displayName,
                quality: normalizedQuality,
                type: "direct"
              };
            }
          } else if (link.includes("supervideo")) {
            streamUrl = yield extractSuperVideo(link);
            playerName = "SuperVideo";
            if (streamUrl) {
              let quality = "HD";
              const lowerUrl = streamUrl.toLowerCase();
              if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
              else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
              else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
              else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
              else if (lowerUrl.includes("360")) quality = "360p";
              const normalizedQuality = getQualityFromName(quality);
              const displayName = `${title} ${season}x${episode}`;
              return {
                url: streamUrl,
                name: `Guardaserie - ${playerName}`,
                title: displayName,
                quality: normalizedQuality,
                type: "direct"
              };
            }
          } else if (link.includes("mixdrop")) {
            const extracted = yield extractMixDrop(link);
            if (extracted && extracted.url) {
              let quality = "HD";
              const lowerUrl = extracted.url.toLowerCase();
              if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
              else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
              else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
              else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
              else if (lowerUrl.includes("360")) quality = "360p";
              const normalizedQuality = getQualityFromName(quality);
              const displayName = `${title} ${season}x${episode}`;
              return {
                url: extracted.url,
                headers: extracted.headers,
                name: `Guardaserie - MixDrop`,
                title: displayName,
                quality: normalizedQuality,
                type: "direct"
              };
            }
          }
        } catch (e) {
          console.error(`[Guardaserie] Error extracting link ${link}:`, e);
        }
        return null;
      }));
      const results = yield Promise.all(streamPromises);
      return results.filter((r) => r !== null);
    } catch (e) {
      console.error("[Guardaserie] Error:", e);
      return [];
    }
  });
}
module.exports = { getStreams };
