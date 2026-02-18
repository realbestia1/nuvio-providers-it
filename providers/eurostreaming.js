const BASE_URL = 'https://eurostreaming.luxe';
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

async function getImdbId(tmdbId, type) {
    try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        // For TV shows, we might need external_ids to get IMDB ID if not in main response
        // But usually name is what we need for Eurostreaming search
        if (data.imdb_id) return data.imdb_id;
        
        const externalUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const extResponse = await fetch(externalUrl);
        if (extResponse.ok) {
            const extData = await extResponse.json();
            if (extData.imdb_id) return extData.imdb_id;
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] Conversion error:', e);
        return null;
    }
}

async function getShowInfo(tmdbId, type) {
    try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error('[EuroStreaming] TMDB error:', e);
        return null;
    }
}

// Unpacker for Dean Edwards packer (used by MixDrop etc)
function unPack(p, a, c, k, e, d) {
    e = function (c) {
        return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36))
    };
    if (!''.replace(/^/, String)) {
        while (c--) {
            d[e(c)] = k[c] || e(c)
        }
        k = [function (e) {
            return d[e] || e
        }];
        e = function () {
            return '\\w+'
        };
        c = 1
    };
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c])
        }
    }
    return p;
}

async function extractStreamTape(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url);
        if (!response.ok) return null;
        const html = await response.text();

        // StreamTape extraction: look for robotlink
        const match = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = '(.*?)'/);
        if (match) {
            let link = match[1];
            // Sometimes it's concatenated
            // e.g. 'part1' + 'part2'
            // We need to clean it up? usually it is just one string in the simple regex match if we are lucky
            // But often it is: .innerHTML = '...'+'...'
            
            // Let's try to match the full concatenation
            // document.getElementById('robotlink').innerHTML = '...' + '...'
            
            // Better regex for the whole line
            const lineMatch = html.match(/document\.getElementById\('robotlink'\)\.innerHTML = (.*);/);
            if (lineMatch) {
                const raw = lineMatch[1];
                // Evaluate the string concatenation (safe-ish if it's just strings)
                // e.g. "'https://streamtape.com/get_video?id=...' + '...'"
                // We can just strip quotes and pluses
                const cleanLink = raw.replace(/['"\+\s]/g, '');
                if (cleanLink.startsWith('//')) return 'https:' + cleanLink;
                if (cleanLink.startsWith('http')) return cleanLink;
            }
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] StreamTape extraction error:', e);
        return null;
    }
}

async function extractVidoza(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url);
        if (!response.ok) return null;
        const html = await response.text();
        
        // Vidoza usually has sources: [{file:"..."}]
        const match = html.match(/sources:\s*\[\s*\{\s*file:\s*"(.*?)"/);
        if (match) {
            return match[1];
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] Vidoza extraction error:', e);
        return null;
    }
}

async function extractDeltaBit(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url);
        if (!response.ok) return null;
        const html = await response.text();
        
        // DeltaBit often uses packer
        const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = packedRegex.exec(html);

        if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split('|');
            const unpacked = unPack(p, a, c, k, null, {});
            
            // Look for file:
            const fileMatch = unpacked.match(/file:\s*"(.*?)"/);
            if (fileMatch) {
                return fileMatch[1];
            }
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] DeltaBit extraction error:', e);
        return null;
    }
}

async function extractUqload(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url);
        if (!response.ok) return null;
        const html = await response.text();
        
        // Uqload sources: ["..."]
        const match = html.match(/sources:\s*\["(.*?)"\]/);
        if (match) {
            return match[1];
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] Uqload extraction error:', e);
        return null;
    }
}

async function extractMixDrop(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
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
            const k = match[4].split('|');
            const unpacked = unPack(p, a, c, k, null, {});
            
            // console.log(`[EuroStreaming] MixDrop Unpacked: ${unpacked}`); // DEBUG

            const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
            if (wurlMatch) {
                let streamUrl = wurlMatch[1];
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                
                // Use origin from the input URL as Referer (handles .co, .to, .ch etc.)
                const urlObj = new URL(url);
                const referer = urlObj.origin + '/';
                const origin = urlObj.origin;
                
                // Nuvio documentation specifies passing headers in a separate object.
            // Do NOT append headers to the URL (e.g. |Referer=...) as this might break the URL in Nuvio's player.
            
            return {
                url: streamUrl,
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": referer,
                    "Origin": origin
                }
            };
            }
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] MixDrop extraction error:', e);
        return null;
    }
}

async function extractDropLoad(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
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
            const k = match[4].split('|');
            const unpacked = unPack(p, a, c, k, null, {});
            
            // Find file:"..."
            const fileMatch = unpacked.match(/file:"(.*?)"/);
            if (fileMatch) {
                let streamUrl = fileMatch[1];
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                
                // Use origin as Referer
                const referer = new URL(url).origin + '/';
                
                return {
                    url: streamUrl,
                    headers: {
                        'User-Agent': USER_AGENT,
                        'Referer': referer
                    }
                };
            }
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] DropLoad extraction error:', e);
        return null;
    }
}

async function extractSuperVideo(url) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        let directUrl = url.replace('/e/', '/').replace('/embed-', '/');
        
        let response = await fetch(directUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });

        let html = await response.text();
        
        if (html.includes('This video can be watched as embed only')) {
            let embedUrl = url;
            if (!embedUrl.includes('/e/') && !embedUrl.includes('/embed-')) {
                 embedUrl = directUrl.replace('.cc/', '.cc/e/');
            }
            response = await fetch(embedUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Referer': BASE_URL
                }
            });
            html = await response.text();
        }

        if (html.includes('Cloudflare') || response.status === 403) {
            return null;
        }

        const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = packedRegex.exec(html);

        if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split('|');
            const unpacked = unPack(p, a, c, k, null, {});
            
            const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
            if (fileMatch) {
                let streamUrl = fileMatch[1];
                if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                return streamUrl;
            }
        }
        return null;
    } catch (e) {
        console.error('[EuroStreaming] SuperVideo extraction error:', e);
        return null;
    }
}

async function searchShow(query) {
    try {
        console.log(`[EuroStreaming] Searching for: ${query}`);
        const params = new URLSearchParams();
        params.append('do', 'search');
        params.append('subaction', 'search');
        params.append('story', query);

        // Use GET instead of POST to align with Guardaserie and potential caching
        const response = await fetch(`${BASE_URL}/index.php?${params.toString()}`, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': BASE_URL
            }
        });
        
        if (!response.ok) return [];
        
        const html = await response.text();
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
            // Fallback: if no results found, try a broader search or just return empty
            // But let's log it clearly
            console.log(`[EuroStreaming] No results found for query: "${query}"`);
            return [];
        }

        console.log(`[EuroStreaming] Search results for "${query}": ${results.length} found`);
        
        const candidates = [];
        const lowerQuery = query.toLowerCase();
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedQuery = normalize(query);

        results.forEach(r => {
            let score = 0;
            const lowerTitle = r.title.toLowerCase();
            const normalizedTitle = normalize(r.title);

            if (lowerTitle === lowerQuery) {
                score = 100; // Exact match
            } else if (lowerTitle.startsWith(lowerQuery)) {
                score = 80; // Starts with
            } else if (normalizedTitle.includes(normalizedQuery)) {
                score = 60; // Normalized match / contains
            } else {
                // Check word match
                try {
                    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const wordRegex = new RegExp(`\\b${escapedQuery}\\b`, 'i');
                    if (wordRegex.test(r.title)) {
                        score = 70; // Word match
                    } else {
                        score = 10; // Fallback
                    }
                } catch (e) {
                    score = 10;
                }
            }
            candidates.push({ ...r, score });
        });
        
        // If we have results but none matched well (score 10), keep them anyway
        // because sometimes titles are very different (e.g. "Money Heist" vs "La Casa de Papel")
        // But the caller will sort by score.
        
        return candidates.sort((a, b) => b.score - a.score);

    } catch (e) {
        console.error('[EuroStreaming] Search error:', e);
        return [];
    }
}

async function getTmdbIdFromImdb(imdbId, type) {
    try {
        const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (type === 'movie' && data.movie_results?.length > 0) return data.movie_results[0].id;
        if (type === 'tv' && data.tv_results?.length > 0) return data.tv_results[0].id;
        return null;
    } catch (e) {
        console.error('[EuroStreaming] ID conversion error:', e);
        return null;
    }
}

async function getStreams(id, type, season, episode, showInfo) {
    if (type === 'movie') return []; // EuroStreaming focuses on TV series

    try {
        let tmdbId = id;
        if (id.toString().startsWith('tt')) {
            tmdbId = await getTmdbIdFromImdb(id, type);
            if (!tmdbId) {
                console.log(`[EuroStreaming] Could not convert ${id} to TMDB ID`);
                return [];
            }
        } else if (id.toString().startsWith('tmdb:')) {
            tmdbId = id.toString().replace('tmdb:', '');
        }

        let fetchedShowInfo = showInfo;
        if (!fetchedShowInfo) {
             fetchedShowInfo = await getShowInfo(tmdbId, type);
        }
        
        if (!fetchedShowInfo) {
            console.log(`[EuroStreaming] Could not get show info for ${tmdbId}`);
            return [];
        }
        
        const titlesToTry = [];
        if (fetchedShowInfo.name) titlesToTry.push(fetchedShowInfo.name);
        if (fetchedShowInfo.title) titlesToTry.push(fetchedShowInfo.title);
        if (fetchedShowInfo.original_name) titlesToTry.push(fetchedShowInfo.original_name);
        if (fetchedShowInfo.original_title) titlesToTry.push(fetchedShowInfo.original_title);
        
        // Deduplicate
        const uniqueTitles = [...new Set(titlesToTry.filter(Boolean))];
        
        const allCandidates = [];
        for (const t of uniqueTitles) {
            console.log(`[EuroStreaming] Searching title: ${t}`);
            const results = await searchShow(t);
            if (results && results.length > 0) {
                allCandidates.push(...results);
            }
        }
        
        // Deduplicate URLs (keep highest score)
        const uniqueCandidates = [];
        const seenUrls = new Set();
        // Sort by score first so we keep the highest scored version of a URL
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

        // Try top candidates (up to 3)
        const topCandidates = uniqueCandidates.slice(0, 3);
        console.log(`[EuroStreaming] Testing ${topCandidates.length} candidates for ${tmdbId}`);

        const streams = [];
        const promises = [];
        
        for (const candidate of topCandidates) {
            promises.push((async () => {
                try {
                    console.log(`[EuroStreaming] Checking candidate: ${candidate.title} (${candidate.url})`);
                    const response = await fetch(candidate.url, {
                        headers: {
                            'User-Agent': USER_AGENT,
                            'Referer': BASE_URL
                        }
                    });
                    
                    if (!response.ok) {
                        console.log(`[EuroStreaming] Failed to fetch candidate page: ${response.status}`);
                        return;
                    }
                    
                    const html = await response.text();
                    
                    // Check if page has the episode
                    // Look for data-num="{season}x{episode}"
                    // e.g. data-num="1x1" or "1x01"
                    const episodeStr1 = `${season}x${episode}`;
                    const episodeStr2 = `${season}x${episode.toString().padStart(2, '0')}`;
                    const episodeRegex = new RegExp(`data-num="(${episodeStr1}|${episodeStr2})"`, 'i');
                    const episodeMatch = episodeRegex.exec(html);
                    
                    if (!episodeMatch) {
                        console.log(`[EuroStreaming] Episode ${season}x${episode} not found in candidate`);
                        return;
                    }

                    console.log(`[EuroStreaming] Found episode match at index ${episodeMatch.index}`);
                    
                    const startIndex = episodeMatch.index;
                    const endLiIndex = html.indexOf('</li>', startIndex);
                    if (endLiIndex === -1) return;
                    
                    const episodeBlock = html.substring(startIndex, endLiIndex);
                    const linkRegex = /data-link=["']([^"']+)["']/g;
                    let linkMatch;
                    const innerPromises = [];
                    
                    while ((linkMatch = linkRegex.exec(episodeBlock)) !== null) {
                        let name = "Source";
                        const url = linkMatch[1];
                        if (url.includes('dropload')) name = "DropLoad";
                        else if (url.includes('mixdrop')) name = "MixDrop";
                        else if (url.includes('supervideo')) name = "SuperVideo";
                        else if (url.includes('deltabit')) name = "DeltaBit";
                        else if (url.includes('vidoza')) name = "Vidoza";
                        else if (url.includes('streamtape')) name = "StreamTape";
                        else if (url.includes('uqload')) name = "Uqload";
                        
                        innerPromises.push((async () => {
                             try {
                                 let streamUrl = url;
                                 if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                                 
                                 if (streamUrl.includes('mixdrop') || streamUrl.includes('m1xdrop')) {
                                   const extracted = await extractMixDrop(streamUrl);
                                   if (extracted && extracted.url) {
                                       streams.push({
                                           name: `EuroStreaming (${name})`,
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
                                }
                                else if (streamUrl.includes('dropload')) {
                                    const extracted = await extractDropLoad(streamUrl);
                                    if (extracted && extracted.url) {
                                        streams.push({
                                           name: `EuroStreaming (${name})`,
                                           title: 'Watch',
                                           url: extracted.url,
                                           headers: extracted.headers,
                                           quality: 'auto',
                                           type: 'url'
                                       });
                                    }
                                }
                                else if (streamUrl.includes('supervideo')) {
                                    const extracted = await extractSuperVideo(streamUrl);
                                    if (extracted) {
                                        streams.push({
                                           name: `EuroStreaming (${name})`,
                                           title: 'Watch',
                                           url: extracted,
                                           quality: 'auto',
                                           type: 'url'
                                       });
                                    }
                                }
                                else if (streamUrl.includes('deltabit')) {
                                    const extracted = await extractDeltaBit(streamUrl);
                                    if (extracted) {
                                        streams.push({
                                           name: `EuroStreaming (${name})`,
                                           title: 'Watch',
                                           url: extracted,
                                           quality: 'auto',
                                           type: 'url'
                                       });
                                    }
                                }
                                else if (streamUrl.includes('vidoza')) {
                                    const extracted = await extractVidoza(streamUrl);
                                    if (extracted) {
                                        streams.push({
                                           name: `EuroStreaming (${name})`,
                                           title: 'Watch',
                                           url: extracted,
                                           quality: 'auto',
                                           type: 'url'
                                       });
                                    }
                                }
                                else if (streamUrl.includes('streamtape') || streamUrl.includes('tape')) {
                                    const extracted = await extractStreamTape(streamUrl);
                                    if (extracted) {
                                        streams.push({
                                           name: `EuroStreaming (${name})`,
                                           title: 'Watch',
                                           url: extracted,
                                           quality: 'auto',
                                           type: 'url'
                                       });
                                    }
                                }
                                else if (streamUrl.includes('uqload')) {
                                    const extracted = await extractUqload(streamUrl);
                                    if (extracted) {
                                        streams.push({
                                           name: `EuroStreaming (${name})`,
                                           title: 'Watch',
                                           url: extracted,
                                           quality: 'auto',
                                           type: 'url'
                                       });
                                    }
                                }
                             } catch(e) { console.error(e); }
                        })());
                    }
                    
                    await Promise.all(innerPromises);
                } catch (e) {
                    console.error(`[EuroStreaming] Error processing candidate ${candidate.title}:`, e);
                }
            })());
        }
        
        await Promise.all(promises);
        
        if (streams.length > 0) {
            console.log(`[EuroStreaming] Found ${streams.length} streams total`);
            return streams;
        }
        
        return [];

    } catch (e) {
        console.error('[EuroStreaming] Error:', e);
        return [];
    }
}

module.exports = { 
    getStreams,
    extractMixDrop,
    extractDropLoad,
    extractSuperVideo,
    extractDeltaBit,
    extractVidoza,
    extractStreamTape,
    extractUqload
};
