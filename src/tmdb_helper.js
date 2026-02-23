const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

async function getTmdbFromKitsu(kitsuId) {
    try {
        const id = String(kitsuId).replace("kitsu:", "");
        
        // Fetch Mappings
        const mappingResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}/mappings`);
        let mappingData = null;
        if (mappingResponse.ok) {
            mappingData = await mappingResponse.json();
        }

        let tmdbId = null;
        let season = null;

        // Try to find TMDB ID from mappings
        if (mappingData && mappingData.data) {
            // Try TheTVDB
            const tvdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'thetvdb');
            if (tvdbMapping) {
                const tvdbId = tvdbMapping.attributes.externalId;
                // TVDB ID often maps to TMDB TV ID
                const findUrl = `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`;
                const findResponse = await fetch(findUrl);
                const findData = await findResponse.json();
                
                if (findData.tv_results?.length > 0) tmdbId = findData.tv_results[0].id;
                else if (findData.movie_results?.length > 0) return { tmdbId: findData.movie_results[0].id, season: null };
            }

            // Try IMDb
            if (!tmdbId) {
                const imdbMapping = mappingData.data.find(m => m.attributes.externalSite === 'imdb');
                if (imdbMapping) {
                    const imdbId = imdbMapping.attributes.externalId;
                    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
                    const findResponse = await fetch(findUrl);
                    const findData = await findResponse.json();
                    
                    if (findData.tv_results?.length > 0) tmdbId = findData.tv_results[0].id;
                    else if (findData.movie_results?.length > 0) return { tmdbId: findData.movie_results[0].id, season: null };
                }
            }
        }

        // Fallback: Search by Title from Kitsu Details
        // We also need details to guess the season
        const detailsResponse = await fetch(`https://kitsu.io/api/edge/anime/${id}`);
        if (!detailsResponse.ok) return null;
        const detailsData = await detailsResponse.json();
        
        if (detailsData && detailsData.data && detailsData.data.attributes) {
            const attributes = detailsData.data.attributes;
            // Collect possible titles
            const titlesToTry = new Set();
            if (attributes.titles.en) titlesToTry.add(attributes.titles.en);
            if (attributes.titles.en_jp) titlesToTry.add(attributes.titles.en_jp);
            if (attributes.canonicalTitle) titlesToTry.add(attributes.canonicalTitle);
            if (attributes.titles.ja_jp) titlesToTry.add(attributes.titles.ja_jp); // Sometimes original title helps? Maybe not on TMDB English search.
            
            // Convert to array
            const titleList = Array.from(titlesToTry);

            const year = attributes.startDate ? attributes.startDate.substring(0, 4) : null;
            const subtype = attributes.subtype;
            
            // If we still don't have TMDB ID, search by title
            if (!tmdbId) {
                const type = (subtype === 'movie') ? 'movie' : 'tv';
                
                for (const title of titleList) {
                    if (tmdbId) break; // Found it
                    if (!title) continue;

                    let searchData = { results: [] };
                    
                    // First try search WITH year if available
                    if (year) {
                        let yearParam = '';
                        if (type === 'movie') yearParam = `&primary_release_year=${year}`;
                        else yearParam = `&first_air_date_year=${year}`;
                        
                        const searchUrlYear = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}${yearParam}`;
                        const res = await fetch(searchUrlYear);
                        const data = await res.json();
                        if (data.results && data.results.length > 0) {
                            searchData = data;
                        }
                    }
                    
                    // If no results with strict year, try without year
                    if (!searchData.results || searchData.results.length === 0) {
                        const searchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${TMDB_API_KEY}`;
                        const searchResponse = await fetch(searchUrl);
                        searchData = await searchResponse.json();
                    }
                    
                    if (searchData.results && searchData.results.length > 0) {
                        if (year) {
                            // Try to find exact year match in the results (even if we searched without year)
                            const match = searchData.results.find(r => {
                                const date = type === 'movie' ? r.release_date : r.first_air_date;
                                return date && date.startsWith(year);
                            });
                            
                            if (match) {
                                tmdbId = match.id;
                            } else {
                                // Fallback logic
                                tmdbId = searchData.results[0].id;
                            }
                        } else {
                            tmdbId = searchData.results[0].id;
                        }
                    } else if (subtype !== 'movie') {
                        // If strict search failed, try cleaning title (remove season number)
                        // "My Hero Academia 2" -> "My Hero Academia"
                        const cleanTitle = title.replace(/\s(\d+)$/, '').replace(/\sSeason\s\d+$/i, '');
                        if (cleanTitle !== title) {
                            const cleanSearchUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(cleanTitle)}&api_key=${TMDB_API_KEY}`;
                            const cleanSearchResponse = await fetch(cleanSearchUrl);
                            const cleanSearchData = await cleanSearchResponse.json();
                            if (cleanSearchData.results && cleanSearchData.results.length > 0) {
                                tmdbId = cleanSearchData.results[0].id;
                            }
                        }
                    }
                } // End for titles
            }
            
            // Get best title for season heuristic
            const title = attributes.titles.en || attributes.titles.en_jp || attributes.canonicalTitle;

            // Determine Season from Title
            if (tmdbId && subtype !== 'movie') {
                // Heuristic to extract season number from title
                // e.g. "My Hero Academia 2", "Attack on Titan Season 3", "Overlord II"
                
                // Explicit "Season X"
                const seasonMatch = title.match(/Season\s*(\d+)/i) || title.match(/(\d+)(?:st|nd|rd|th)\s*Season/i);
                if (seasonMatch) {
                    season = parseInt(seasonMatch[1]);
                } 
                // "Title X" (e.g. Boku no Hero Academia 2)
                else if (title.match(/\s(\d+)$/)) {
                    season = parseInt(title.match(/\s(\d+)$/)[1]);
                }
                // Roman Numerals
                else if (title.match(/\sII$/)) season = 2;
                else if (title.match(/\sIII$/)) season = 3;
                else if (title.match(/\sIV$/)) season = 4;
                else if (title.match(/\sV$/)) season = 5;
                
                // If the Kitsu ID maps to a TVDB ID that is NOT the main series ID but a season ID?
                // Hard to know without querying TVDB fully. 
                // But usually the "find" by TVDB ID returns the main series TMDB ID.
                
                // If we found a season, great. If not, default to null (caller might assume 1).
            }
        }

        return { tmdbId, season };

    } catch (e) {
        console.error("[Kitsu] Error converting ID:", e);
        return null;
    }
}

async function getSeasonEpisodeFromAbsolute(tmdbId, absoluteEpisode) {
    try {
        const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=seasons`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();

        let totalEpisodes = 0;
        
        // Sort seasons by number just in case
        const seasons = data.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
        
        for (const season of seasons) {
            if (absoluteEpisode <= totalEpisodes + season.episode_count) {
                return {
                    season: season.season_number,
                    episode: absoluteEpisode - totalEpisodes
                };
            }
            totalEpisodes += season.episode_count;
        }
        
        // If we overflow, maybe it's in the last season or unknown
        return null;
    } catch (e) {
        console.error("[TMDB] Error mapping absolute episode:", e);
        return null;
    }
}

module.exports = { getTmdbFromKitsu, getSeasonEpisodeFromAbsolute };
