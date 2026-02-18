
const extractMixDrop = require('../extractors/mixdrop');
const extractDropLoad = require('../extractors/dropload');
const extractSuperVideo = require('../extractors/supervideo');

const BASE_URL = 'https://guardahd.stream';
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getImdbId(tmdbId, type) {
    try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.imdb_id) return data.imdb_id;
        
        const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const extResponse = await fetch(externalUrl);
        if (extResponse.ok) {
            const extData = await extResponse.json();
            if (extData.imdb_id) return extData.imdb_id;
        }
        return null;
    } catch (e) {
        console.error('[GuardaHD] Conversion error:', e);
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    if (type !== 'movie') return [];

    let cleanId = id.toString();
    if (cleanId.startsWith('tmdb:')) cleanId = cleanId.replace('tmdb:', '');

    let imdbId = cleanId;
    if (!cleanId.startsWith('tt')) {
        const convertedId = await getImdbId(cleanId, type);
        if (convertedId) imdbId = convertedId;
        else return [];
    }

    let url;
    if (type === 'movie') {
        url = `${BASE_URL}/set-movie-a/${imdbId}`;
    } else if (type === 'tv') {
        url = `${BASE_URL}/set-tv-a/${imdbId}/${season}/${episode}`;
    } else {
        return [];
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const streams = [];
        const linkRegex = /data-link=["']([^"']+)["']/g;
        let match;
        
        // Helper to process a URL
        const processUrl = async (streamUrl, name) => {
             if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
             
             // MixDrop
             if (streamUrl.includes('mixdrop') || streamUrl.includes('m1xdrop')) {
                console.log(`[GuardaHD] Attempting MixDrop extraction for ${streamUrl}`);
                const extracted = await extractMixDrop(streamUrl, BASE_URL, USER_AGENT);
                if (extracted && extracted.url) {
                    streams.push({
                        name: 'GuardaHD (MixDrop)',
                        title: 'Watch',
                        url: extracted.url,
                        headers: extracted.headers,
                        behaviorHints: {
                            notWebReady: true,
                            proxyHeaders: {
                                request: extracted.headers
                            }
                        },
                        quality: 'auto',
                        type: 'url'
                    });
                }
                return;
             }
             
             // DropLoad
             if (streamUrl.includes('dropload')) {
                 console.log(`[GuardaHD] Attempting DropLoad extraction for ${streamUrl}`);
                 const extracted = await extractDropLoad(streamUrl, BASE_URL, USER_AGENT);
                 if (extracted && extracted.url) {
                     streams.push({
                        name: 'GuardaHD (DropLoad)',
                        title: 'Watch',
                        url: extracted.url,
                        headers: extracted.headers,
                        quality: 'auto',
                        type: 'url'
                    });
                 }
                 return;
             }
             
             // SuperVideo
             if (streamUrl.includes('supervideo')) {
                 console.log(`[GuardaHD] Attempting SuperVideo extraction for ${streamUrl}`);
                 const extracted = await extractSuperVideo(streamUrl, BASE_URL, USER_AGENT);
                 if (extracted) {
                     streams.push({
                        name: 'GuardaHD (SuperVideo)',
                        title: 'Watch',
                        url: extracted,
                        quality: 'auto',
                        type: 'url'
                    });
                 }
                 return;
             }
             

        };

        const promises = [];

        while ((match = linkRegex.exec(html)) !== null) {
            let streamUrl = match[1];
            const tagEndIndex = html.indexOf('>', match.index);
            const liEndIndex = html.indexOf('</li>', tagEndIndex);
            let name = 'Unknown';
            if (tagEndIndex !== -1 && liEndIndex !== -1) {
                name = html.substring(tagEndIndex + 1, liEndIndex).replace(/<\/?[^>]+(>|$)/g, "").trim();
            }
            promises.push(processUrl(streamUrl, name));
        }
        
        // Also check the active iframe player
        const iframeRegex = /<iframe[^>]+id=["']_player["'][^>]+src=["']([^"']+)["']/;
        const iframeMatch = iframeRegex.exec(html);
        if (iframeMatch) {
            let activeUrl = iframeMatch[1];
             if (activeUrl.startsWith('//')) activeUrl = 'https:' + activeUrl;
             // Avoid duplicate processing if it was already in the list? 
             // The list comes from data-link. The iframe is usually one of them but "active".
             // We can just process it again, worst case duplicate, but better check.
             // Actually, usually the iframe src is NOT in data-link explicitly or it is one of them.
             // Let's just process it.
             promises.push(processUrl(activeUrl, "Active Player"));
        }

        await Promise.all(promises);
        
        // Deduplicate streams by URL
        const uniqueStreams = [];
        const seenUrls = new Set();
        for (const s of streams) {
            if (!seenUrls.has(s.url)) {
                seenUrls.add(s.url);
                uniqueStreams.push(s);
            }
        }

        return uniqueStreams;

    } catch (error) {
        console.error('[GuardaHD] Error:', error);
        return [];
    }
}

module.exports = { getStreams };
