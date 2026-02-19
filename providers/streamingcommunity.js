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
const BASE_URL = "https://vixsrc.to";
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": "https://vixsrc.to/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};
function getTmdbId(imdbId, type) {
  return __async(this, null, function* () {
    const endpoint = type === "movie" ? "movie" : "tv";
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const response = yield fetch(findUrl);
      if (!response.ok) return null;
      const data = yield response.json();
      if (!data) return null;
      if (type === "movie" && data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0].id.toString();
      } else if ((type === "tv" || type === "series") && data.tv_results && data.tv_results.length > 0) {
        return data.tv_results[0].id.toString();
      }
      return null;
    } catch (e) {
      console.error("[StreamingCommunity] Conversion error:", e);
      return null;
    }
  });
}
function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    let tmdbId = id.toString();
    if (tmdbId.startsWith("tmdb:")) {
      tmdbId = tmdbId.replace("tmdb:", "");
    }
    if (tmdbId.startsWith("tt")) {
      const convertedId = yield getTmdbId(tmdbId, type);
      if (convertedId) {
        console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
        tmdbId = convertedId;
      } else {
        console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
      }
    }
    let url;
    if (type === "movie") {
      url = `${BASE_URL}/movie/${tmdbId}`;
    } else if (type === "tv" || type === "series") {
      url = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
    } else {
      return [];
    }
    try {
      console.log(`[StreamingCommunity] Fetching page: ${url}`);
      const response = yield fetch(url, {
        headers: COMMON_HEADERS
      });
      if (!response.ok) {
        console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
        return [];
      }
      const html = yield response.text();
      if (!html) return [];
      const tokenMatch = html.match(/'token':\s*'([^']+)'/);
      const expiresMatch = html.match(/'expires':\s*'([^']+)'/);
      const urlMatch = html.match(/url:\s*'([^']+)'/);
      if (tokenMatch && expiresMatch && urlMatch) {
        const token = tokenMatch[1];
        const expires = expiresMatch[1];
        const baseUrl = urlMatch[1];
        let streamUrl;
        if (baseUrl.includes("?b=1")) {
          streamUrl = `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=it`;
        } else {
          streamUrl = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=it`;
        }
        console.log(`[StreamingCommunity] Found stream URL: ${streamUrl}`);
        try {
          const playlistResponse = yield fetch(streamUrl, {
            headers: COMMON_HEADERS
          });
          if (playlistResponse.ok) {
            const playlistText = yield playlistResponse.text();
            const hasItalian = /LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"/i.test(playlistText);
            const has1080p = /RESOLUTION=\d+x1080|RESOLUTION=1080/i.test(playlistText);
            if (hasItalian) console.log(`[StreamingCommunity] Verified: Has Italian audio.`);
            if (has1080p) console.log(`[StreamingCommunity] Verified: Has 1080p stream.`);
          } else {
            console.warn(`[StreamingCommunity] Playlist check failed (${playlistResponse.status}), returning anyway.`);
          }
        } catch (verError) {
          console.warn(`[StreamingCommunity] Playlist check error, returning anyway:`, verError);
        }
        return [{
          name: "StreamingCommunity",
          title: "Watch",
          url: streamUrl,
          quality: "1080p",
          type: "direct",
          headers: COMMON_HEADERS
        }];
      } else {
        console.log("[StreamingCommunity] Could not find playlist info in HTML");
        return [];
      }
    } catch (error) {
      console.error("[StreamingCommunity] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
