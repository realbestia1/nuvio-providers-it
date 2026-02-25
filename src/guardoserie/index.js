const cheerio = require('cheerio');
const { USER_AGENT } = require('../extractors/common');
const { extractLoadm, extractUqload, extractDropLoad } = require('../extractors');
const { formatStream } = require('../formatter');
const { getTmdbFromKitsu } = require('../tmdb_helper');
const { checkQualityFromPlaylist } = require('../quality_helper');

const BASE_URL = 'https://guardoserie.horse';
const TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

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

async function getShowInfo(tmdbId, type) {
    try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error('[Guardoserie] TMDB error:', e);
        return null;
    }
}

async function getStreams(id, type, season, episode) {
    try {
        let tmdbId = id;
        if (id.toString().startsWith('tt')) {
            // Need to convert IMDb to TMDB for title/year info
            const url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (type === 'movie' && data.movie_results?.length > 0) tmdbId = data.movie_results[0].id;
                else if ((type === 'series' || type === 'tv') && data.tv_results?.length > 0) tmdbId = data.tv_results[0].id;
            }
        } else if (id.toString().startsWith('kitsu:')) {
            const resolved = await getTmdbFromKitsu(id);
            if (resolved && resolved.tmdbId) {
                tmdbId = resolved.tmdbId;
                if (resolved.season) season = resolved.season;
            }
        }

        const showInfo = await getShowInfo(tmdbId, type === 'movie' ? 'movie' : 'tv');
        if (!showInfo) return [];

        const title = showInfo.name || showInfo.original_name || showInfo.title || showInfo.original_title;
        const originalTitle = showInfo.original_title || showInfo.original_name;
        const year = (showInfo.first_air_date || showInfo.release_date || '').split('-')[0];

        console.log(`[Guardoserie] Searching for: ${title} / ${originalTitle} (${year})`);

        // Search helper
        const searchProvider = async (query) => {
            const searchUrl = `${BASE_URL}/wp-admin/admin-ajax.php`;
            const params = new URLSearchParams({
                s: query,
                action: 'searchwp_live_search',
                swpengine: 'default',
                swpquery: query
            });

            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': BASE_URL,
                    'Referer': `${BASE_URL}/`
                },
                body: params.toString()
            });

            if (!response.ok) return [];
            const searchHtml = await response.text();
            const $ = cheerio.load(searchHtml);
            const results = [];
            $('a.ss-title').each((i, el) => {
                results.push({
                    title: $(el).text().trim(),
                    url: $(el).attr('href')
                });
            });
            return results;
        };

        let allResults = [];
        const queries = [title, originalTitle].filter(q => q && q.length > 2);
        for (const q of queries) {
            const res = await searchProvider(q);
            allResults.push(...res);
        }

        // Deduplicate results by URL
        allResults = Array.from(new Map(allResults.map(item => [item.url, item])).values());

        let targetUrl = null;
        for (const result of allResults) {
            // Check title match first to avoid unnecessary fetches
            const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace('iltronodispade', 'gameofthrones');
            const nTitle = norm(title);
            const nOrig = norm(originalTitle || '');
            const nResult = norm(result.title);

            if (nResult === nTitle || nResult === nOrig || nResult.includes(nTitle) || (nOrig && nResult.includes(nOrig))) {
                // Verify year in the page
                try {
                    const pageRes = await fetch(result.url, { headers: { 'User-Agent': USER_AGENT } });
                    if (!pageRes.ok) continue;
                    const pageHtml = await pageRes.text();
                    const $page = cheerio.load(pageHtml);

                    // Target the year specifically in the info box as suggested by user
                    let foundYear = null;
                    const infoBox = $page('.mvic-info');

                    // 1. Try "pubblicazione" link in info box
                    const yearLink = infoBox.find('p:contains("pubblicazione") a[href*="release-year"]');
                    if (yearLink.length) {
                        foundYear = yearLink.text().trim();
                    }

                    // 2. Try meta tags (ISO date) - look specifically inside info box or head
                    if (!foundYear) {
                        const metaDate = $page('meta[content*="20"]').filter((i, el) => {
                            const content = $page(el).attr('content');
                            return content && /^20\d{2}-\d{2}-\d{2}/.test(content);
                        }).first().attr('content');

                        if (metaDate) {
                            foundYear = metaDate.substring(0, 4);
                        }
                    }

                    // 3. Last resort: ANY release-year link NOT in the related section
                    if (!foundYear) {
                        const globalYearLink = $page('a[href*="release-year"]').filter((i, el) => {
                            // Exclude links in the "related" or "footer" sections
                            const isRelated = $page(el).closest('.mlw-related, footer, #footer').length > 0;
                            return !isRelated;
                        }).first();

                        if (globalYearLink.length) {
                            foundYear = globalYearLink.text().trim();
                        }
                    }

                    if (foundYear) {
                        if (foundYear === year) {
                            targetUrl = result.url;
                            break;
                        }
                    } else {
                        // If no year found at all, accept by title
                        targetUrl = result.url;
                        break;
                    }
                } catch (e) {
                    // If fetch fails, but title matches, we can still try it as fallback
                    targetUrl = result.url;
                    break;
                }
            }
        }

        if (!targetUrl) {
            console.log(`[Guardoserie] No matching result found for ${title}`);
            return [];
        }

        let episodeUrl = targetUrl;
        if (type === 'tv' || type === 'series') {
            const pageRes = await fetch(targetUrl, { headers: { 'User-Agent': USER_AGENT } });
            const pageHtml = await pageRes.text();
            const $page = cheerio.load(pageHtml);

            const seasonIndex = parseInt(season) - 1;
            const episodeIndex = parseInt(episode) - 1;

            // Try different selectors for seasons
            let seasonDiv = $page('.les-content').eq(seasonIndex);

            // If the structure is different (e.g. no .les-content but .tvseason)
            if (!seasonDiv.length) {
                const seasonBlocks = $page('.tvseason');
                if (seasonBlocks.length > 0) {
                    seasonDiv = seasonBlocks.eq(seasonIndex).find('.les-content');
                }
            }

            if (!seasonDiv.length) {
                console.log(`[Guardoserie] Season ${season} not found at ${targetUrl}`);
                return [];
            }

            const episodeA = seasonDiv.find('a').eq(episodeIndex);
            if (!episodeA.length) {
                console.log(`[Guardoserie] Episode ${episode} not found in Season ${season}`);
                return [];
            }

            episodeUrl = episodeA.attr('href');
        }

        console.log(`[Guardoserie] Found episode/movie URL: ${episodeUrl}`);
        const finalRes = await fetch(episodeUrl, { headers: { 'User-Agent': USER_AGENT } });
        const finalHtml = await finalRes.text();
        const $final = cheerio.load(finalHtml);

        const iframe = $final('iframe');
        const playerLink = iframe.attr('data-src') || iframe.attr('src');

        if (!playerLink) {
            console.log(`[Guardoserie] No player iframe found`);
            return [];
        }

        console.log(`[Guardoserie] Found player link: ${playerLink}`);
        const displayName = (type === 'tv' || type === 'series') ? `${title} ${season}x${episode}` : title;
        let streams = [];

        if (playerLink.includes('loadm')) {
            const domain = new URL(BASE_URL).hostname;
            const extracted = await extractLoadm(playerLink, domain);
            for (const s of (extracted || [])) {
                let quality = "HD";
                if (s.url.includes('.m3u8')) {
                    const detected = await checkQualityFromPlaylist(s.url, s.headers || {});
                    if (detected) quality = detected;
                }
                const normalizedQuality = getQualityFromName(quality);

                streams.push(formatStream({
                    url: s.url,
                    headers: s.headers,
                    name: `Guardoserie - Loadm`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct",
                    behaviorHints: s.behaviorHints
                }, 'Guardoserie'));
            }
        } else if (playerLink.includes('uqload')) {
            const extracted = await extractUqload(playerLink);
            if (extracted && extracted.url) {
                let quality = "HD";
                const normalizedQuality = getQualityFromName(quality);
                streams.push(formatStream({
                    url: extracted.url,
                    headers: extracted.headers,
                    name: `Guardoserie - Uqload`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                }, 'Guardoserie'));
            }
        } else if (playerLink.includes('dropload')) {
            const extracted = await extractDropLoad(playerLink);
            if (extracted && extracted.url) {
                let quality = "HD";
                if (extracted.url.includes('.m3u8')) {
                    const detected = await checkQualityFromPlaylist(extracted.url, extracted.headers || {});
                    if (detected) quality = detected;
                }
                const normalizedQuality = getQualityFromName(quality);
                streams.push(formatStream({
                    url: extracted.url,
                    headers: extracted.headers,
                    name: `Guardoserie - DropLoad`,
                    title: displayName,
                    quality: normalizedQuality,
                    type: "direct"
                }, 'Guardoserie'));
            }
        }

        return streams;
    } catch (e) {
        console.error(`[Guardoserie] Error:`, e);
        return [];
    }
}

module.exports = { getStreams };
