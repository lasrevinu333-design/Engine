import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const port = Number(process.env.PORT || 4173);
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml']
]);

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const candidate = resolve(root, `.${pathname === '/' ? '/start_page1.html' : pathname}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!statSync(candidate).isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'Content-Type': types.get(extname(candidate)) || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1');
