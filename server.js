const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // Set CORS headers for Nuvio
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url);
    console.log(`[REQUEST] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

    let filePath = '.' + parsedUrl.pathname;
    
    // Default to manifest.json if root is requested
    if (filePath === './') {
        filePath = './manifest.json';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/plain';
    
    switch (extname) {
        case '.json':
            contentType = 'application/json';
            break;
        case '.js':
            contentType = 'text/javascript';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT'){
                console.log(`File not found: ${filePath}`);
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            console.log(`Serving ${filePath} as ${contentType}`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Nuvio Plugin Server running at http://localhost:${PORT}/`);
    console.log(`Manifest URL: http://localhost:${PORT}/manifest.json`);
});
