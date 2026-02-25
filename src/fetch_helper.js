
const FETCH_TIMEOUT = 30000; // 30 seconds

async function fetchWithTimeout(url, options = {}) {
    // If global fetch doesn't exist, we can't do much in a browser/RN env
    if (typeof fetch === 'undefined') {
        throw new Error("No fetch implementation found!");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, options.timeout || FETCH_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request to ${url} timed out after ${options.timeout || FETCH_TIMEOUT}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = { fetchWithTimeout };
