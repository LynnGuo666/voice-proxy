import type { Env } from '../core/types.js';
import { proxyRequest } from '../core/proxy.js';
import { handleHLS } from '../core/hls.js';
import { handleDASH } from '../core/dash.js';
import { handleOptions, addCorsHeaders } from '../utils/cors.js';
import { validateReferer } from '../utils/auth.js';
import { getCacheTTL, applyCacheHeaders } from '../utils/cache.js';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Only allow GET and HEAD methods
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return addCorsHeaders(
        new Response('Method not allowed', { status: 405 })
      );
    }

    // Validate Referer
    if (!validateReferer(request, env)) {
      return addCorsHeaders(
        new Response('Forbidden', { status: 403 })
      );
    }

    // Parse request URL
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // Handle root path
    if (url.pathname === '/' && !targetUrl) {
      return addCorsHeaders(
        new Response('LynnVoice Proxy - Use /proxy?url=<encoded_url>', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      );
    }

    // Require URL parameter for /proxy endpoint
    if (url.pathname === '/proxy' || url.pathname === '/') {
      if (!targetUrl) {
        return addCorsHeaders(
          new Response('Missing url parameter', { status: 400 })
        );
      }

      // Validate target URL
      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        return addCorsHeaders(
          new Response('Invalid URL', { status: 400 })
        );
      }

      // Only allow http/https protocols
      if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
        return addCorsHeaders(
          new Response('Only http/https URLs are allowed', { status: 400 })
        );
      }

      const proxyOrigin = url.origin;

      try {
        let response: Response;

        // Route based on file type
        if (targetUrl.includes('.m3u8') || targetUrl.includes('.M3U8')) {
          response = await handleHLS(request, targetUrl, proxyOrigin);
        } else if (targetUrl.includes('.mpd') || targetUrl.includes('.MPD')) {
          response = await handleDASH(request, targetUrl, proxyOrigin);
        } else {
          response = await proxyRequest(request, targetUrl);
        }

        // Apply cache headers
        const cacheTTL = getCacheTTL(targetUrl, env);
        response = applyCacheHeaders(response, cacheTTL);

        // Add CORS headers
        return addCorsHeaders(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return addCorsHeaders(
          new Response(`Proxy error: ${message}`, { status: 502 })
        );
      }
    }

    // 404 for other paths
    return addCorsHeaders(
      new Response('Not found', { status: 404 })
    );
  },
};
