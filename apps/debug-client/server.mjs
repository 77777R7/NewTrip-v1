import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const workspaceRoot = resolve(appDir, '../..');
const publicDir = join(appDir, 'public');
const assetsDir = join(workspaceRoot, 'assets');
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
const port = Number(process.env.PORT ?? 5173);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safePath(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] ?? '/');
  const resolved = resolve(baseDir, `.${normalize(decoded)}`);
  return resolved.startsWith(baseDir) ? resolved : null;
}

async function proxyApi(req, res) {
  const apiPath = req.url.replace(/^\/api/, '') || '/';
  const body = await new Promise((resolveBody) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
  });

  try {
    const upstream = await fetch(`${backendUrl}${apiPath}`, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] ?? 'application/json',
        'x-newtrip-auth-id': req.headers['x-newtrip-auth-id'] ?? 'debug-client',
      },
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body,
    });
    const text = await upstream.text();
    send(res, upstream.status, text, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
  } catch (error) {
    send(res, 502, JSON.stringify({
      error: 'BACKEND_UNAVAILABLE',
      message: error instanceof Error ? error.message : String(error),
      backendUrl,
    }), { 'content-type': 'application/json; charset=utf-8' });
  }
}

function serveFile(req, res, baseDir, requestPath) {
  const filePath = safePath(baseDir, requestPath);
  if (!filePath || !existsSync(filePath)) {
    send(res, 404, 'Not found', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }

  res.writeHead(200, {
    'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) {
    void proxyApi(req, res);
    return;
  }

  if (req.url?.startsWith('/assets/')) {
    serveFile(req, res, assetsDir, req.url.replace(/^\/assets/, ''));
    return;
  }

  const requestPath = req.url === '/' ? '/index.html' : req.url ?? '/index.html';
  serveFile(req, res, publicDir, requestPath);
});

server.listen(port, () => {
  console.log(`NewTrip debug client: http://localhost:${port}`);
  console.log(`Proxying backend API: ${backendUrl}`);
});
