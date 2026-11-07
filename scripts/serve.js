import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const files = new Set(['index.html', 'styles.css', 'js/app.js', 'js/controller.js', 'js/model.js', 'js/storage.js', 'js/view.js']);
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let path;
  try {
    path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1) || 'index.html';
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (!files.has(path)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(fileURLToPath(new URL(path, root)));
    const extension = path.slice(path.lastIndexOf('.'));
    response.writeHead(200, {
      'Content-Type': `${types[extension]}; charset=utf-8`,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500).end('Could not read application file');
  }
});
server.on('error', error => {
  console.error(`Could not start the local server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`TodoMVC is ready at http://127.0.0.1:${server.address().port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
