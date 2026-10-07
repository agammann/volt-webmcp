export function createSitesWorker(embeddedAssets) {
  return `const embeddedAssets = ${JSON.stringify(embeddedAssets)};

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function responseFor(asset, requestMethod, requestPath) {
  const headers = new Headers(securityHeaders);
  headers.set('Content-Type', asset.contentType);
  headers.set(
    'Cache-Control',
    requestPath.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : asset.contentType.startsWith('text/html')
        ? 'public, max-age=0, must-revalidate, no-transform'
        : 'public, max-age=0, must-revalidate',
  );

  return new Response(requestMethod === 'HEAD' ? null : decodeBase64(asset.body), { headers });
}

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: securityHeaders });
    }

    const url = new URL(request.url);
    let requestPath;
    try {
      requestPath = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400, headers: securityHeaders });
    }

    if (requestPath === '/') {
      return responseFor(embeddedAssets['/index.html'], request.method, '/index.html');
    }

    const exactAsset = Object.hasOwn(embeddedAssets, requestPath) ? embeddedAssets[requestPath] : undefined;
    if (exactAsset) return responseFor(exactAsset, request.method, requestPath);

    return new Response('Not found', { status: 404, headers: securityHeaders });
  },
};
`;
}
