const { default: worker } = await import(
  `../dist/server/index.js?build=${Date.now()}`
);

const rootResponse = await worker.fetch(new Request('https://volt.invalid/'));
if (rootResponse.status !== 200)
  throw new Error(`Sites worker root returned ${rootResponse.status}.`);
if (!rootResponse.headers.get('content-type')?.startsWith('text/html')) {
  throw new Error('Sites worker root did not return HTML.');
}
if (!(await rootResponse.text()).includes('id="root"')) {
  throw new Error(
    'Sites worker root did not contain the Vite application shell.',
  );
}
if (
  rootResponse.headers.get('strict-transport-security') !== 'max-age=31536000'
) {
  throw new Error(
    'Sites worker root did not include the expected HSTS policy.',
  );
}

if (
  rootResponse.headers.get('cache-control') !==
  'public, max-age=0, must-revalidate, no-transform'
) {
  throw new Error(
    'HTML must retain no-transform without changing cache lifetime.',
  );
}
if (
  !rootResponse.headers
    .get('content-security-policy')
    ?.includes("script-src 'self'") ||
  rootResponse.headers
    .get('content-security-policy')
    ?.includes("script-src 'self' 'unsafe-inline'")
) {
  throw new Error('HTML must preserve the script content security policy.');
}

const discoveryFiles = [
  ['/llms.txt', 'text/plain', '# Volt'],
  [
    '/robots.txt',
    'text/plain',
    'Sitemap: https://volt.alx21.chatgpt.site/sitemap.xml',
  ],
  ['/sitemap.xml', 'application/xml', '<urlset'],
];

for (const [path, contentType, marker] of discoveryFiles) {
  const response = await worker.fetch(
    new Request(`https://volt.invalid${path}`),
  );
  if (response.status !== 200)
    throw new Error(`Sites worker did not serve ${path}.`);
  if (!response.headers.get('content-type')?.startsWith(contentType)) {
    throw new Error(
      `Sites worker returned the wrong content type for ${path}.`,
    );
  }
  if (!(await response.text()).includes(marker)) {
    throw new Error(`Sites worker returned unexpected content for ${path}.`);
  }
}

const missingResponse = await worker.fetch(
  new Request('https://volt.invalid/missing.png', {
    headers: { accept: 'image/png' },
  }),
);
if (missingResponse.status !== 404)
  throw new Error('Sites worker did not preserve asset 404s.');

const methodResponse = await worker.fetch(
  new Request('https://volt.invalid/', { method: 'POST' }),
);
if (methodResponse.status !== 405)
  throw new Error('Sites worker did not reject write methods.');

const missingPage = await worker.fetch(
  new Request('https://volt.invalid/missing-page', {
    headers: { accept: 'text/html' },
  }),
);
if (missingPage.status !== 404)
  throw new Error('Unknown pages must return 404.');
const head = await worker.fetch(
  new Request('https://volt.invalid/', { method: 'HEAD' }),
);
if (head.status !== 200 || (await head.text()) !== '')
  throw new Error('HEAD must not return a body.');
