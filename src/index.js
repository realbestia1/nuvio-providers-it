const animeunity = require('./animeunity/index');
const animeworld = require('./animeworld/index');
const guardahd = require('./guardahd/index');
const guardaserie = require('./guardaserie/index');
const guardoserie = require('./guardoserie/index');
const streamingcommunity = require('./streamingcommunity/index');

async function getStreams(id, type, season, episode) {
    const streams = [];
    const normalizedType = type.toLowerCase();
    const promises = [];

    promises.push(
        animeunity.getStreams(id, normalizedType, season, episode)
            .then(s => ({ provider: 'AnimeUnity', streams: s, status: 'fulfilled' }))
            .catch(e => ({ provider: 'AnimeUnity', error: e, status: 'rejected' }))
    );
    promises.push(
        streamingcommunity.getStreams(id, normalizedType, season, episode)
            .then(s => ({ provider: 'StreamingCommunity', streams: s, status: 'fulfilled' }))
            .catch(e => ({ provider: 'StreamingCommunity', error: e, status: 'rejected' }))
    );

    if (normalizedType === 'movie') {
        promises.push(
            guardahd.getStreams(id, normalizedType, season, episode)
                .then(s => ({ provider: 'GuardaHD', streams: s, status: 'fulfilled' }))
                .catch(e => ({ provider: 'GuardaHD', error: e, status: 'rejected' }))
        );
        promises.push(
            guardoserie.getStreams(id, normalizedType, season, episode)
                .then(s => ({ provider: 'Guardoserie', streams: s, status: 'fulfilled' }))
                .catch(e => ({ provider: 'Guardoserie', error: e, status: 'rejected' }))
        );
    }

    if (normalizedType === 'tv' || normalizedType === 'series') {
        promises.push(
            guardaserie.getStreams(id, normalizedType, season, episode)
                .then(s => ({ provider: 'Guardaserie', streams: s, status: 'fulfilled' }))
                .catch(e => ({ provider: 'Guardaserie', error: e, status: 'rejected' }))
        );
        promises.push(
            guardoserie.getStreams(id, normalizedType, season, episode)
                .then(s => ({ provider: 'Guardoserie', streams: s, status: 'fulfilled' }))
                .catch(e => ({ provider: 'Guardoserie', error: e, status: 'rejected' }))
        );
    }

    const results = await Promise.all(promises);
    for (const result of results) {
        if (result.status === 'fulfilled' && result.streams) {
            streams.push(...result.streams);
        }
    }

    return streams;
}

module.exports = { getStreams };
