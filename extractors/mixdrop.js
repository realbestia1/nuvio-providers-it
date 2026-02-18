const unPack = require('./packer');

async function extractMixDrop(url, referer, userAgent) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        const response = await fetch(url, {
            headers: {
                'User-Agent': userAgent,
                'Referer': referer
            }
        });

        if (!response.ok) return null;
        const html = await response.text();

        const packedRegex = /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
        const match = packedRegex.exec(html);

        if (match) {
            const p = match[1];
            const a = parseInt(match[2]);
            const c = parseInt(match[3]);
            const k = match[4].split('|');
            try {
                const unpacked = unPack(p, a, c, k, null, {});
                
                const wurlMatch = unpacked.match(/wurl="([^"]+)"/);
                if (wurlMatch) {
                    let streamUrl = wurlMatch[1];
                    if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                    
                    const urlObj = new URL(url);
                    const ref = urlObj.origin + '/';
                    const origin = urlObj.origin;
                    
                    return {
                        url: streamUrl,
                        headers: {
                            "User-Agent": userAgent,
                            "Referer": ref,
                            "Origin": origin
                        }
                    };
                }
            } catch (e) {
                console.error('[MixDrop] Unpack error:', e);
            }
        }
        return null;
    } catch (e) {
        console.error('[MixDrop] Extraction error:', e);
        return null;
    }
}

module.exports = extractMixDrop;