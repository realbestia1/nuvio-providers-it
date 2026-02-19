const streamingcommunity = require('./streamingcommunity');
const guardahd = require('./guardahd');
const eurostreaming = require('./eurostreaming');
const guardaserie = require('./guardaserie');

async function getStreams(id, type, season, episode) {
    const streams = [];
    const errors = [];
    const normalizedType = type.toLowerCase();
    console.log(`[MultiProvider] Requesting streams for ${id} (${type})`);

    const promises = [];

    // StreamingCommunity supports both movies and tv
    promises.push(
        streamingcommunity.getStreams(id, normalizedType, season, episode)
            .then(streams => ({ provider: 'StreamingCommunity', streams, status: 'fulfilled' }))
            .catch(error => ({ provider: 'StreamingCommunity', error, status: 'rejected' }))
    );

    // GuardaHD supports only movies
    if (normalizedType === 'movie') {
        promises.push(
            guardahd.getStreams(id, normalizedType, season, episode)
                .then(streams => ({ provider: 'GuardaHD', streams, status: 'fulfilled' }))
                .catch(error => ({ provider: 'GuardaHD', error, status: 'rejected' }))
        );
    }

    // EuroStreaming and Guardaserie support only tv series
    if (normalizedType === 'tv' || normalizedType === 'series') {
        promises.push(
            eurostreaming.getStreams(id, normalizedType, season, episode)
                .then(streams => ({ provider: 'EuroStreaming', streams, status: 'fulfilled' }))
                .catch(error => ({ provider: 'EuroStreaming', error, status: 'rejected' }))
        );
        promises.push(
            guardaserie.getStreams(id, normalizedType, season, episode)
                .then(streams => ({ provider: 'Guardaserie', streams, status: 'fulfilled' }))
                .catch(error => ({ provider: 'Guardaserie', error, status: 'rejected' }))
        );
    }

    const results = await Promise.all(promises);

    for (const result of results) {
        if (result.status === 'fulfilled') {
            if (result.streams && result.streams.length > 0) {
                console.log(`[MultiProvider] ${result.provider} found ${result.streams.length} streams`);
                streams.push(...result.streams);
            }
        } else {
            console.error(`[MultiProvider] ${result.provider} error:`, result.error);
        }
    }

    return streams;
}

module.exports = { getStreams };
