import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSitesWorker } from './sites-worker.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(projectRoot, 'dist');
const serverRoot = resolve(distRoot, 'server');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }

  return files;
}

const assetFiles = (await listFiles(distRoot)).filter((path) => {
  const relativePath = relative(distRoot, path).split(sep).join('/');
  return (
    !relativePath.startsWith('server/') && !relativePath.startsWith('.openai/')
  );
});

const embeddedAssets = {};
for (const path of assetFiles) {
  const relativePath = relative(distRoot, path).split(sep).join('/');
  embeddedAssets[`/${relativePath}`] = {
    body: (await readFile(path)).toString('base64'),
    contentType:
      contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream',
  };
}

if (!embeddedAssets['/index.html'])
  throw new Error('The Vite build did not emit dist/index.html.');

await mkdir(serverRoot, { recursive: true });
await writeFile(
  resolve(serverRoot, 'index.js'),
  createSitesWorker(embeddedAssets),
);
