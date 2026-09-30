import { createServer } from 'node:http';
import worker from '../dist/server/index.js';
const port = Number(process.env.PORT ?? 3018);
createServer(async (req, res) => {
  try {
    const response = await worker.fetch(
      new Request(new URL(req.url, `http://127.0.0.1:${port}`), {
        method: req.method,
        headers: req.headers,
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Preview failed');
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Volt build at http://127.0.0.1:${port}`),
);
