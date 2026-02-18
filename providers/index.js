const vixsrc = require('./vixsrc');
const guardahd = require('./guardahd');
const eurostreaming = require('./eurostreaming');
const guardaserie = require('./guardaserie');

async function getStreams(id, type, season, episode) {
    const streams = [];
    const errors = [];

    console.log(`[MultiProvider] Requesting streams for ${id} (${type})`);

    // Execute in parallel
    const [vixResult, guardahdResult, euroResult, guardaserieResult] = await Promise.allSettled([
        vixsrc.getStreams(id, type, season, episode),
        guardahd.getStreams(id, type, season, episode),
        eurostreaming.getStreams(id, type, season, episode),
        guardaserie.getStreams(id, type, season, episode)
    ]);

    if (vixResult.status === 'fulfilled') {
        if (vixResult.value && vixResult.value.length > 0) {
            console.log(`[MultiProvider] VixSrc found ${vixResult.value.length} streams`);
            streams.push(...vixResult.value);
        }
    } else {
        console.error('[MultiProvider] VixSrc error:', vixResult.reason);
    }

    if (guardahdResult.status === 'fulfilled') {
        if (guardahdResult.value && guardahdResult.value.length > 0) {
            console.log(`[MultiProvider] GuardaHD found ${guardahdResult.value.length} streams`);
            streams.push(...guardahdResult.value);
        }
    } else {
        console.error('[MultiProvider] GuardaHD error:', guardahdResult.reason);
    }

    if (euroResult.status === 'fulfilled') {
        if (euroResult.value && euroResult.value.length > 0) {
            console.log(`[MultiProvider] EuroStreaming found ${euroResult.value.length} streams`);
            streams.push(...euroResult.value);
        }
    } else {
        console.error('[MultiProvider] EuroStreaming error:', euroResult.reason);
    }

    if (guardaserieResult.status === 'fulfilled') {
        if (guardaserieResult.value && guardaserieResult.value.length > 0) {
            console.log(`[MultiProvider] Guardaserie found ${guardaserieResult.value.length} streams`);
            streams.push(...guardaserieResult.value);
        }
    } else {
        console.error('[MultiProvider] Guardaserie error:', guardaserieResult.reason);
    }

    return streams;
}

module.exports = { getStreams };
