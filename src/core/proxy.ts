import { buildForwardHeaders, RESPONSE_HEADERS } from './types.js';

// Proxy a request to the target URL (for Worker)
export async function proxyRequest(
  request: Request,
  targetUrl: string
): Promise<Response> {
  const forwardHeaders = buildForwardHeaders(request.headers);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: forwardHeaders,
  });

  // Build response headers
  const responseHeaders = new Headers();
  for (const header of RESPONSE_HEADERS) {
    const value = response.headers.get(header);
    if (value) {
      responseHeaders.set(header, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

// Fetch content from target URL (shared utility)
export async function fetchTarget(
  targetUrl: string,
  headers: Headers
): Promise<Response> {
  return fetch(targetUrl, {
    method: 'GET',
    headers,
  });
}

// Fetch text content from target URL
export async function fetchTargetText(
  targetUrl: string,
  headers: Headers
): Promise<{ content: string; response: Response }> {
  const response = await fetchTarget(targetUrl, headers);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const content = await response.text();
  return { content, response };
}
