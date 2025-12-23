import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';

// CORS headers for responses
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Accept, Accept-Encoding',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

// Handle OPTIONS preflight request (for Worker)
export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// Add CORS headers to response (for Worker)
export function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// CORS middleware for Express
export function corsMiddleware(
  _req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
): void {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  next();
}

// Handle OPTIONS for Express
export function handleExpressOptions(
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
): void {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
