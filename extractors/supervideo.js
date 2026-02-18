const unPack = require('./packer');

async function extractSuperVideo(url, referer, userAgent) {
    try {
        if (url.startsWith('//')) url = 'https:' + url;
        let directUrl = url.replace('/e/', '/').replace('/embed-', '/');
        
        let response = await fetch(directUrl, {
            headers: {
                'User-Agent': userAgent,
                'Referer': referer
            }
        });

        if (!response.ok) return null;

        let html = await response.text();
        
        if (html.includes('This video can be watched as embed only')) {
            let embedUrl = url;
            if (!embedUrl.includes('/e/') && !embedUrl.includes('/embed-')) {
                 embedUrl = directUrl.replace('.cc/', '.cc/e/');
            }
            response = await fetch(embedUrl, {
                headers: {
                    'User-Agent': userAgent,
                    'Referer': referer
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
            try {
                const unpacked = unPack(p, a, c, k, null, {});
                
                const fileMatch = unpacked.match(/sources:\[\{file:"(.*?)"/);
                if (fileMatch) {
                    let streamUrl = fileMatch[1];
                    if (streamUrl.startsWith('//')) streamUrl = 'https:' + streamUrl;
                    return streamUrl;
                }
            } catch (e) {
                console.error('[SuperVideo] Unpack error:', e);
            }
        }
        return null;
    } catch (e) {
        console.error('[SuperVideo] Extraction error:', e);
        return null;
    }
}

module.exports = extractSuperVideo;