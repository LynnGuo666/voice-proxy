import { buildForwardHeaders, resolveUrl, buildProxyUrl, getBaseUrl } from './types.js';
import { fetchTargetText } from './proxy.js';

// Rewrite URLs in DASH MPD manifest
export function rewriteDASHContent(
  content: string,
  baseUrl: string,
  proxyOrigin: string
): string {
  let rewritten = content;

  // Rewrite BaseURL elements
  rewritten = rewritten.replace(
    /<BaseURL>([^<]+)<\/BaseURL>/g,
    (_, url) => {
      const absoluteUrl = resolveUrl(baseUrl, url.trim());
      return `<BaseURL>${buildProxyUrl(proxyOrigin, absoluteUrl)}</BaseURL>`;
    }
  );

  // Rewrite media/initialization attributes in SegmentTemplate
  rewritten = rewritten.replace(
    /media="([^"]+)"/g,
    (match, url) => {
      // Skip if it's a template with $variables$
      if (url.includes('$')) {
        // For templates, we need to rewrite the base URL instead
        return match;
      }
      const absoluteUrl = resolveUrl(baseUrl, url);
      return `media="${buildProxyUrl(proxyOrigin, absoluteUrl)}"`;
    }
  );

  rewritten = rewritten.replace(
    /initialization="([^"]+)"/g,
    (match, url) => {
      if (url.includes('$')) {
        return match;
      }
      const absoluteUrl = resolveUrl(baseUrl, url);
      return `initialization="${buildProxyUrl(proxyOrigin, absoluteUrl)}"`;
    }
  );

  // Rewrite sourceURL in SegmentList
  rewritten = rewritten.replace(
    /sourceURL="([^"]+)"/g,
    (_, url) => {
      const absoluteUrl = resolveUrl(baseUrl, url);
      return `sourceURL="${buildProxyUrl(proxyOrigin, absoluteUrl)}"`;
    }
  );

  // Rewrite xlink:href attributes
  rewritten = rewritten.replace(
    /xlink:href="([^"]+)"/g,
    (_, url) => {
      const absoluteUrl = resolveUrl(baseUrl, url);
      return `xlink:href="${buildProxyUrl(proxyOrigin, absoluteUrl)}"`;
    }
  );

  // Handle SegmentTemplate with $-variables by adding a BaseURL if not present
  // This is a simplified approach - complex DASH manifests may need more handling
  if (rewritten.includes('$RepresentationID$') || rewritten.includes('$Number$')) {
    // Check if there's already a BaseURL at the MPD level
    if (!rewritten.includes('<BaseURL>')) {
      // Add BaseURL after MPD opening tag
      const mpdMatch = rewritten.match(/<MPD[^>]*>/);
      if (mpdMatch) {
        const baseUrlElement = `<BaseURL>${buildProxyUrl(proxyOrigin, getBaseUrl(baseUrl))}</BaseURL>`;
        rewritten = rewritten.replace(mpdMatch[0], `${mpdMatch[0]}\n  ${baseUrlElement}`);
      }
    }
  }

  return rewritten;
}

// Handle DASH request (for Worker)
export async function handleDASH(
  request: Request,
  targetUrl: string,
  proxyOrigin: string
): Promise<Response> {
  const forwardHeaders = buildForwardHeaders(request.headers);

  try {
    const { content } = await fetchTargetText(targetUrl, forwardHeaders);
    const rewritten = rewriteDASHContent(content, targetUrl, proxyOrigin);

    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/dash+xml',
        'Cache-Control': 'max-age=30',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`DASH proxy error: ${message}`, { status: 502 });
  }
}
