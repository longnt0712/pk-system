import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5505);
const emulatorConfig = process.argv.includes('--emulator') && [
    'export const firebaseConfig = {apiKey: "demo-api-key", authDomain: "demo-so-viec-xu-doan.firebaseapp.com",',
    'projectId: "demo-so-viec-xu-doan", appId: "1:123:web:demo"};',
    'export const useEmulators = true;'
].join('\n');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain', '.rules': 'text/plain'};

createServer(async (request, response) => {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        const type = types[extname(filename)];
        if (!filename.startsWith(root + sep) || !type) { response.writeHead(404).end(); return; }
        const contents = emulatorConfig && pathname === '/firebase-config.js' ? emulatorConfig : await readFile(filename);
        response.writeHead(200, {'Content-Type': type + '; charset=utf-8'});
        response.end(request.method === 'HEAD' ? undefined : contents);
    } catch { response.writeHead(404).end('Không tìm thấy tệp.'); }
}).listen(port, '127.0.0.1', () => {
    console.log('Mở Sổ việc Xứ đoàn tại http://localhost:' + port);
});
