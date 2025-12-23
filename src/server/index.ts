import express from 'express';
import { corsMiddleware, handleExpressOptions, CORS_HEADERS } from '../utils/cors.js';
import { validateExpressReferer } from '../utils/auth.js';
import { rewriteHLSContent } from '../core/hls.js';
import { rewriteDASHContent } from '../core/dash.js';
import { buildForwardHeaders, RESPONSE_HEADERS } from '../core/types.js';
import { getCacheTTL, buildCacheControl } from '../utils/cache.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use(corsMiddleware);
app.use(handleExpressOptions);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.send('OK');
});

// Root endpoint
app.get('/', (req, res) => {
  const targetUrl = req.query.url as string | undefined;
  if (!targetUrl) {
    res.send('LynnVoice Proxy - Use /proxy?url=<encoded_url>');
    return;
  }
  // Redirect to /proxy with the same query
  res.redirect(`/proxy?url=${encodeURIComponent(targetUrl)}`);
});

// Main proxy endpoint
app.get('/proxy', async (req, res) => {
  // Validate Referer
  if (!validateExpressReferer(req)) {
    res.status(403).send('Forbidden');
    return;
  }

  const targetUrl = req.query.url as string | undefined;

  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // Validate URL
  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    res.status(400).send('Invalid URL');
    return;
  }

  // Only allow http/https
  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    res.status(400).send('Only http/https URLs are allowed');
    return;
  }

  const proxyOrigin = `${req.protocol}://${req.get('host')}`;

  try {
    // Build forward headers
    const forwardHeaders: Record<string, string> = {};
    const headersToCopy = ['range', 'accept', 'accept-encoding', 'user-agent'];
    for (const header of headersToCopy) {
      const value = req.headers[header];
      if (value && typeof value === 'string') {
        forwardHeaders[header] = value;
      }
    }

    // Fetch from target
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: forwardHeaders,
    });

    // Handle HLS
    if (targetUrl.toLowerCase().includes('.m3u8')) {
      const content = await response.text();
      const rewritten = rewriteHLSContent(content, targetUrl, proxyOrigin);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', buildCacheControl(getCacheTTL(targetUrl, process.env)));
      res.send(rewritten);
      return;
    }

    // Handle DASH
    if (targetUrl.toLowerCase().includes('.mpd')) {
      const content = await response.text();
      const rewritten = rewriteDASHContent(content, targetUrl, proxyOrigin);

      res.setHeader('Content-Type', 'application/dash+xml');
      res.setHeader('Cache-Control', buildCacheControl(getCacheTTL(targetUrl, process.env)));
      res.send(rewritten);
      return;
    }

    // Handle direct stream - pipe the response
    res.status(response.status);

    // Copy response headers
    for (const header of RESPONSE_HEADERS) {
      const value = response.headers.get(header);
      if (value) {
        res.setHeader(header, value);
      }
    }

    // Set cache control
    res.setHeader('Cache-Control', buildCacheControl(getCacheTTL(targetUrl, process.env)));

    // Stream the response body
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy error:', message);
    if (!res.headersSent) {
      res.status(502).send(`Proxy error: ${message}`);
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`LynnVoice Proxy server running on port ${PORT}`);
  console.log(`Allowed Referers: ${process.env.ALLOWED_REFERERS || '(none configured)'}`);
  console.log(`Allow empty Referer: ${process.env.ALLOW_EMPTY_REFERER || 'false'}`);
});
