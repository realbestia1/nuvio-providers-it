var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
const BASE_URL = "https://eurostreaming.luxe";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const { extractMixDrop, extractDropLoad, extractSuperVideo, extractStreamTape, extractVidoza } = require('../extractors');

async function getTmdbFromKitsu(kitsuId) {
    try {
        const id = String(kitsuId).replace("kitsu:", "");
        const mappingResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
        if (!mappingResponse.ok) return null;
        const mappingData = await mappingResponse.json();
        
        if (!mappingData || !mappingData.data) return null;

        // Try TVDB
        const tvdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'thetvdb/series' || m.attributes.externalSite === 'thetvdb');
        if (tvdbMapping) {
            const tvdbId = String(tvdbMapping.attributes.externalId).split('/')[0];
            const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`;
            const findResponse = await fetch(findUrl);
            const findData = await findResponse.json();
            
            if (findData.tv_results?.length > 0) return findData.tv_results[0].id;
            if (findData.movie_results?.length > 0) return findData.movie_results[0].id;
        }
        
        // Try IMDb
        const imdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'imdb');
        if (imdbMapping) {
             const imdbId = imdbMapping.attributes.externalId;
             const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
             const findResponse = await fetch(findUrl);
             const findData = await findResponse.json();
             if (findData.tv_results?.length > 0) return findData.tv_results[0].id;
             if (findData.movie_results?.length > 0) return findData.movie_results[0].id;
        }

        return null;
    } catch (e) {
        console.error("[Kitsu] Error converting ID:", e);
        return null;
    }
}

function getQualityFromName(qualityStr) {
  if (!qualityStr) return 'Unknown';

  const quality = qualityStr.toUpperCase();

  // Map API quality values to normalized format
  if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
  if (quality === '4K' || quality === '2160P') return '4K';
  if (quality === '1440P' || quality === '2K') return '1440p';
  if (quality === '1080P' || quality === 'FHD') return '1080p';
  if (quality === '720P' || quality === 'HD') return '720p';
  if (quality === '480P' || quality === 'SD') return '480p';
  if (quality === '360P') return '360p';
  if (quality === '240P') return '240p';

  // Try to extract number from string and format consistently
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return '4K';
    if (resolution >= 1440) return '1440p';
    if (resolution >= 1080) return '1080p';
    if (resolution >= 720) return '720p';
    if (resolution >= 480) return '480p';
    if (resolution >= 360) return '360p';
    return '240p';
  }

  return 'Unknown';
}

function getImdbId(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (data.imdb_id) return data.imdb_id;
      const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const extResponse = yield fetch(externalUrl);
      if (extResponse.ok) {
        const extData = yield extResponse.json();
        if (extData.imdb_id) return extData.imdb_id;
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] Conversion error:", e);
      return null;
    }
  });
}
function getShowInfo(tmdbId, type) {
  return __async(this, null, function* () {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      console.error("[EuroStreaming] TMDB error:", e);
      return null;
    }
  });
}

function extractDeltaBit(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
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
        const fileMatch = unpacked.match(/file:\s*"(.*?)"/);
        if (fileMatch) {
          return fileMatch[1];
        }
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] DeltaBit extraction error:", e);
      return null;
    }
  });
}
function extractUqload(url) {
  return __async(this, null, function* () {
    try {
      if (url.startsWith("//")) url = "https:" + url;
      const response = yield fetch(url);
      if (!response.ok) return null;
      const html = yield response.text();
      const match = html.match(/sources:\s*\["(.*?)"\]/);
      if (match) {
        return match[1];
      }
      return null;
    } catch (e) {
      console.error("[EuroStreaming] Uqload extraction error:", e);
      return null;
    }
  });
}

function searchShow(query) {
  return __async(this, null, function* () {
    try {
      console.log(`[EuroStreaming] Searching for: ${query}`);
      const params = new URLSearchParams();
      params.append("do", "search");
      params.append("subaction", "search");
      params.append("story", query);
      const response = yield fetch(`${BASE_URL}/index.php?${params.toString()}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": BASE_URL
        }
      });
      if (!response.ok) return [];
      const html = yield response.text();
      const resultRegex = /<div class="post-thumb">\s*<a href="([^"]+)" title="([^"]+)">/g;
      let match;
      const results = [];
      while ((match = resultRegex.exec(html)) !== null) {
        results.push({
          url: match[1],
          title: match[2]
        });
      }
      if (results.length === 0) {
        console.log(`[EuroStreaming] No results found for query: "${query}"`);
        return [];
      }
      console.log(`[EuroStreaming] Search results for "${query}": ${results.length} found`);
      const candidates = [];
      const lowerQuery = query.toLowerCase();
      const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normalizedQuery = normalize(query);
      results.forEach((r) => {
        let score = 0;
        const lowerTitle = r.title.toLowerCase();
        const normalizedTitle = normalize(r.title);
        if (lowerTitle === lowerQuery) {
          score = 100;
        } else if (lowerTitle.startsWith(lowerQuery)) {
          score = 80;
        } else if (normalizedTitle.includes(normalizedQuery)) {
          score = 60;
        } else {
          try {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const wordRegex = new RegExp(`\\b${escapedQuery}\\b`, "i");
            if (wordRegex.test(r.title)) {
              score = 70;
            } else {
              score = 10;
            }
          } catch (e) {
            score = 10;
          }
        }
        candidates.push(__spreadProps(__spreadValues({}, r), { score }));
      });
      return candidates.sort((a, b) => b.score - a.score);
    } catch (e) {
      console.error("[EuroStreaming] Search error:", e);
      return [];
    }
  });
}
function getTmdbIdFromImdb(imdbId, type) {
  return __async(this, null, function* () {
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
      console.error("[EuroStreaming] ID conversion error:", e);
      return null;
    }
  });
}

async function verifyCandidateWithTmdb(title, targetTmdbId, type) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}&language=it-IT`;
        const response = await fetch(searchUrl);
        if (!response.ok) return true; 
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Check if the top result matches our target ID
            const topResult = data.results[0];
            if (String(topResult.id) === String(targetTmdbId)) {
                return true;
            }
            
            // If top result is different, it might be a wrong match (e.g. Live Action vs Anime)
            console.log(`[EuroStreaming] Title verification mismatch: Candidate "${title}" maps to ID ${topResult.id} (${topResult.name || topResult.title}), but expected ${targetTmdbId}`);
            return false;
        }
        return true; // No results found, give benefit of doubt
    } catch (e) {
        console.error("[EuroStreaming] Verification error:", e);
        return true;
    }
}

async function verifyMoviePlayer(url, targetYear) {
    try {
        console.log(`[EuroStreaming] Verifying via MoviePlayer: ${url}`);
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT
            }
        });
        if (!response.ok) return false;
        const html = await response.text();
        
        // Look for "trasmessa dal YYYY" or "Prima messa in onda originale ... YYYY"
        // Pattern 1: trasmessa dal 2008
        const yearMatch1 = html.match(/trasmessa dal (\d{4})/i);
        if (yearMatch1) {
            const foundYear = parseInt(yearMatch1[1]);
            if (Math.abs(foundYear - targetYear) <= 1) {
                console.log(`[EuroStreaming] MoviePlayer verified year ${foundYear} (Target: ${targetYear})`);
                return true;
            }
        }

        // Pattern 2: Prima messa in onda originale ... YYYY
        const yearMatch2 = html.match(/Prima messa in onda originale.*?(\d{4})/i);
        if (yearMatch2) {
             const foundYear = parseInt(yearMatch2[1]);
             if (Math.abs(foundYear - targetYear) <= 1) {
                console.log(`[EuroStreaming] MoviePlayer verified year ${foundYear} (Target: ${targetYear})`);
                return true;
            }
        }

        // Pattern 3: Title (YYYY)
        const titleMatch = html.match(/<title>.*\(.*(\d{4}).*\).*<\/title>/is);
        if (titleMatch) {
             const foundYear = parseInt(titleMatch[1]);
             // Allow a wider range for title year as it might be end year, but usually start year is mentioned
             if (Math.abs(foundYear - targetYear) <= 2) { 
                 console.log(`[EuroStreaming] MoviePlayer verified title year ${foundYear} (Target: ${targetYear})`);
                 return true;
             }
        }
        
        console.log(`[EuroStreaming] MoviePlayer verification failed. Target Year: ${targetYear}`);
        return false;
    } catch (e) {
        console.error("[EuroStreaming] MoviePlayer error:", e);
        return false;
    }
}

function getStreams(id, type, season, episode, showInfo) {
  return __async(this, null, function* () {
    if (String(type).toLowerCase() === "movie") return [];
    try {
      let tmdbId = id;
      let imdbId = null;

      if (id.toString().startsWith("tt")) {
        imdbId = id.toString();
        tmdbId = yield getTmdbIdFromImdb(id, type);
        if (!tmdbId) {
          console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
          return [];
        }
      } else if (id.toString().startsWith("kitsu:")) {
          const resolvedId = yield getTmdbFromKitsu(id);
          if (resolvedId) {
             tmdbId = resolvedId;
             console.log(`[EuroStreaming] Resolved Kitsu ID ${id} to TMDB ID ${tmdbId}`);
          } else {
             console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
             return [];
          }
      } else if (id.toString().startsWith("tmdb:")) {
        tmdbId = id.toString().replace("tmdb:", "");
      }

      // Resolve IMDb ID for verification if we don't have it yet
      if (!imdbId && tmdbId) {
          try {
              const resolvedImdb = yield getImdbId(tmdbId, type);
              if (resolvedImdb) {
                  imdbId = resolvedImdb;
                  console.log(`[EuroStreaming] Resolved TMDB ID ${tmdbId} to IMDb ID ${imdbId} for verification`);
              }
          } catch (e) {
              console.log(`[EuroStreaming] Failed to resolve IMDb ID for verification: ${e.message}`);
          }
      }
      let fetchedShowInfo = showInfo;
      if (!fetchedShowInfo) {
        fetchedShowInfo = yield getShowInfo(tmdbId, type);
      }
      if (!fetchedShowInfo) {
        console.log(`[EuroStreaming] Could not get show info for ${tmdbId}`);
        return [];
      }
      const cleanTitle = fetchedShowInfo.name || fetchedShowInfo.title || fetchedShowInfo.original_name || fetchedShowInfo.original_title || "Serie TV";
      const titlesToTry = [];
      if (fetchedShowInfo.name) titlesToTry.push(fetchedShowInfo.name);
      if (fetchedShowInfo.title) titlesToTry.push(fetchedShowInfo.title);
      if (fetchedShowInfo.original_name) titlesToTry.push(fetchedShowInfo.original_name);
      if (fetchedShowInfo.original_title) titlesToTry.push(fetchedShowInfo.original_title);
      const uniqueTitles = [...new Set(titlesToTry.filter(Boolean))];
      const allCandidates = [];
      for (const t of uniqueTitles) {
        console.log(`[EuroStreaming] Searching title: ${t}`);
        const results = yield searchShow(t);
        if (results && results.length > 0) {
          allCandidates.push(...results);
        }
      }
      const uniqueCandidates = [];
      const seenUrls = /* @__PURE__ */ new Set();
      allCandidates.sort((a, b) => b.score - a.score);
      for (const c of allCandidates) {
        if (!seenUrls.has(c.url)) {
          seenUrls.add(c.url);
          uniqueCandidates.push(c);
        }
      }
      if (uniqueCandidates.length === 0) {
        console.log(`[EuroStreaming] No candidates found for any title of ${tmdbId}`);
        return [];
      }
      const topCandidates = uniqueCandidates.slice(0, 3);
      console.log(`[EuroStreaming] Testing ${topCandidates.length} candidates for ${tmdbId}`);
      const streams = [];
      const promises = [];
      for (const candidate of topCandidates) {
        promises.push(() => __async(null, null, function* () {
          try {
            console.log(`[EuroStreaming] Checking candidate: ${candidate.title} (${candidate.url})`);
            const response = yield fetch(candidate.url, {
              headers: {
                "User-Agent": USER_AGENT,
                "Referer": BASE_URL
              }
            });
            if (!response.ok) {
              console.log(`[EuroStreaming] Failed to fetch candidate page: ${response.status}`);
              return;
            }
            const html = yield response.text();

            let isVerified = false;

            // 1. Check for TMDB Link (Strongest verification)
            // Example link: https://www.themoviedb.org/tv/37854-one-piece
            const tmdbLinkMatches = html.match(/themoviedb\.org\/(?:tv|movie)\/(\d+)/g);
            if (tmdbLinkMatches) {
                 const foundIds = tmdbLinkMatches.map(l => {
                     const m = l.match(/\/(\d+)/);
                     return m ? m[1] : null;
                 }).filter(Boolean);
                 
                 if (foundIds.includes(String(tmdbId))) {
                     console.log(`[EuroStreaming] Verified candidate ${candidate.title} via TMDB link.`);
                     isVerified = true;
                 }
            }

            // 1.5 Check for MoviePlayer.it link (if not verified)
            if (!isVerified) {
                const mpLinkMatch = html.match(/href=["'](https?:\/\/(?:www\.)?movieplayer\.it\/serietv\/[^"']+)["']/i);
                if (mpLinkMatch) {
                    const mpUrl = mpLinkMatch[1];
                    const targetYear = fetchedShowInfo && (fetchedShowInfo.first_air_date || fetchedShowInfo.release_date) 
                        ? parseInt((fetchedShowInfo.first_air_date || fetchedShowInfo.release_date).substring(0, 4)) 
                        : null;
                    
                    if (targetYear) {
                         const mpVerified = yield verifyMoviePlayer(mpUrl, targetYear);
                         if (mpVerified) {
                             isVerified = true;
                             console.log(`[EuroStreaming] Verified candidate ${candidate.title} via MoviePlayer link.`);
                         }
                    }
                }
            }

            // 2. Check for IMDb ID (if not already verified)
            if (!isVerified && imdbId) {
              const targetImdbId = imdbId;
              const imdbMatches = html.match(/tt\d{7,8}/g);
              
              if (imdbMatches && imdbMatches.length > 0) {
                const hasTargetId = imdbMatches.some((match) => match === targetImdbId);
                if (hasTargetId) {
                  console.log(`[EuroStreaming] Verified candidate ${candidate.title} with IMDB ID match.`);
                  isVerified = true;
                } else {
                  console.log(`[EuroStreaming] Rejected candidate ${candidate.title} due to IMDB ID mismatch. Found: ${imdbMatches.join(", ")}`);
                  return;
                }
              }
            }

            // 3. Fallback: Title/Reverse Verification (if not yet verified)
            if (!isVerified) {
                 console.log(`[EuroStreaming] No direct ID match found for ${candidate.title}. Verifying via TMDB search...`);
                 const isTitleMatch = yield verifyCandidateWithTmdb(candidate.title, tmdbId, "tv");
                 if (!isTitleMatch) {
                    console.log(`[EuroStreaming] Rejected candidate ${candidate.title} due to Title mismatch.`);
                    return;
                 }
                 console.log(`[EuroStreaming] Verified candidate ${candidate.title} via TMDB search.`);
                 isVerified = true;
            }

            const episodeStr1 = `${season}x${episode}`;
            const episodeStr2 = `${season}x${episode.toString().padStart(2, "0")}`;
            const episodeRegex = new RegExp(`data-num="(${episodeStr1}|${episodeStr2})"`, "i");
            const episodeMatch = episodeRegex.exec(html);
            if (!episodeMatch) {
              console.log(`[EuroStreaming] Episode ${season}x${episode} not found in candidate`);
              return;
            }
            console.log(`[EuroStreaming] Found episode match at index ${episodeMatch.index}`);
            const startIndex = episodeMatch.index;
            const endLiIndex = html.indexOf("</li>", startIndex);
            if (endLiIndex === -1) return;
            const episodeBlock = html.substring(startIndex, endLiIndex);
            const linkRegex = /data-link=["']([^"']+)["']/g;
            let linkMatch;
            const innerPromises = [];
            while ((linkMatch = linkRegex.exec(episodeBlock)) !== null) {
              let name = "Source";
              const url = linkMatch[1];
              if (url.includes("dropload")) name = "DropLoad";
              else if (url.includes("mixdrop")) name = "MixDrop";
              else if (url.includes("supervideo")) name = "SuperVideo";
              else if (url.includes("deltabit")) name = "DeltaBit";
              else if (url.includes("vidoza")) name = "Vidoza";
              else if (url.includes("streamtape")) name = "StreamTape";
              else if (url.includes("uqload")) name = "Uqload";
              innerPromises.push(() => __async(null, null, function* () {
                try {
                  let streamUrl = url;
                  if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                  if (streamUrl.includes("mixdrop") || streamUrl.includes("m1xdrop")) {
                    const extracted = yield extractMixDrop(streamUrl);
                    if (extracted && extracted.url) {
                      let quality = "HD";
                      const lowerUrl = extracted.url.toLowerCase();
                      if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                      else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                    streams.push({
                      name: `EuroStreaming - ${name}`,
                      title: displayName,
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("dropload")) {
                    const extracted = yield extractDropLoad(streamUrl);
                    if (extracted && extracted.url) {
                      let quality = "HD";
                      const lowerUrl = extracted.url.toLowerCase();
                      if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                    streams.push({
                      name: `EuroStreaming - ${name}`,
                      title: displayName,
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("supervideo")) {
                    const extracted = yield extractSuperVideo(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      const lowerUrl = extracted.toLowerCase();
                      if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                      else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("deltabit")) {
                    const extracted = yield extractDeltaBit(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      const lowerUrl = extracted.toLowerCase();
                      if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                      else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("vidoza")) {
                    const extracted = yield extractVidoza(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      const lowerUrl = extracted.toLowerCase();
                      if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                      else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("streamtape")) {
                    const extracted = yield extractStreamTape(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      const lowerUrl = extracted.toLowerCase();
                      if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                      else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  } else if (streamUrl.includes("uqload")) {
                    const extracted = yield extractUqload(streamUrl);
                    if (extracted) {
                      let quality = "HD";
                      const lowerUrl = extracted.toLowerCase();
                      if (lowerUrl.includes("4k") || lowerUrl.includes("2160")) quality = "4K";
                      else if (lowerUrl.includes("1080") || lowerUrl.includes("fhd")) quality = "1080p";
                      else if (lowerUrl.includes("720") || lowerUrl.includes("hd")) quality = "720p";
                      else if (lowerUrl.includes("480") || lowerUrl.includes("sd")) quality = "480p";
                      else if (lowerUrl.includes("360")) quality = "360p";
                      
                      const normalizedQuality = getQualityFromName(quality);

                      const displayName = `${cleanTitle} ${season}x${episode}`;
                      streams.push({
                        name: `EuroStreaming - ${name}`,
                        title: displayName,
                        url: extracted,
                        quality: normalizedQuality,
                        type: "direct"
                      });
                    }
                  }
                } catch (err) {
                  console.error(`[EuroStreaming] Error extracting ${url}:`, err);
                }
              }));
            }
            yield Promise.all(innerPromises.map((p) => p()));
          } catch (e) {
            console.error(`[EuroStreaming] Error checking candidate ${candidate.url}:`, e);
          }
        }));
      }
      yield Promise.all(promises.map((p) => p()));
      return streams;
    } catch (error) {
      console.error("[EuroStreaming] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
