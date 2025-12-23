import { buildForwardHeaders, resolveUrl, buildProxyUrl } from './types.js';
import { fetchTargetText } from './proxy.js';

// Rewrite URLs in HLS m3u8 playlist
export function rewriteHLSContent(
  content: string,
  baseUrl: string,
  proxyOrigin: string
): string {
  const lines = content.split('\n');
  const rewrittenLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments (except URI in EXT-X-KEY, EXT-X-MAP, etc.)
    if (!trimmed || trimmed.startsWith('#')) {
      // Handle EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA with URI attribute
      if (trimmed.includes('URI="')) {
        const rewritten = trimmed.replace(
          /URI="([^"]+)"/g,
          (_, uri) => {
            const absoluteUrl = resolveUrl(baseUrl, uri);
            return `URI="${buildProxyUrl(proxyOrigin, absoluteUrl)}"`;
          }
        );
        rewrittenLines.push(rewritten);
      } else {
        rewrittenLines.push(line);
      }
      continue;
    }

    // This is a URL line (segment or playlist reference)
    const absoluteUrl = resolveUrl(baseUrl, trimmed);
    rewrittenLines.push(buildProxyUrl(proxyOrigin, absoluteUrl));
  }

  return rewrittenLines.join('\n');
}

// Handle HLS request (for Worker)
export async function handleHLS(
  request: Request,
  targetUrl: string,
  proxyOrigin: string
): Promise<Response> {
  const forwardHeaders = buildForwardHeaders(request.headers);

  try {
    const { content } = await fetchTargetText(targetUrl, forwardHeaders);
    const rewritten = rewriteHLSContent(content, targetUrl, proxyOrigin);

    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'max-age=30',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`HLS proxy error: ${message}`, { status: 502 });
  }
}
