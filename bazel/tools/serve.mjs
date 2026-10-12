import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { argument } from './lib.mjs';

export function startServer(directory, { port = 1313, host = '127.0.0.1' } = {}) {
  const root = path.resolve(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filename = path.resolve(root, '.' + pathname);
      if (filename !== root && !filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      try { if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      let body;
      try { body = await readFile(filename); }
      catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
        filename = path.join(root, '404.html');
        body = await readFile(filename);
        response.statusCode = 404;
      }
      response.setHeader('Content-Type', types[path.extname(filename).toLowerCase()] || 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-cache');
      if (request.method === 'HEAD') response.end();
      else response.end(body);
    } catch { response.writeHead(400).end('Bad request'); }
  });
  server.listen(port, host);
  return server;
}

if (process.argv[1]?.endsWith('serve.mjs')) {
  const port = Number(argument('port', '1313'));
  const server = startServer(argument('root', 'site_dist'), { port, host: argument('host', '127.0.0.1') });
  server.on('listening', () => console.log(`http://127.0.0.1:${server.address().port}/`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
