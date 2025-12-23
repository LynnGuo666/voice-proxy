import { MEDIA_EXTENSIONS, MANIFEST_EXTENSIONS } from '../core/types.js';

// Environment-like object with optional cache config
interface CacheEnv {
  CACHE_MEDIA_TTL?: string;
  CACHE_MANIFEST_TTL?: string;
  [key: string]: string | undefined;
}

// Get cache config from environment
function getCacheConfig(env: CacheEnv): { mediaTTL: number; manifestTTL: number } {
  return {
    mediaTTL: parseInt(env.CACHE_MEDIA_TTL || '86400', 10),
    manifestTTL: parseInt(env.CACHE_MANIFEST_TTL || '30', 10),
  };
}

// Determine cache TTL based on file extension
export function getCacheTTL(url: string, env: CacheEnv): number {
  const config = getCacheConfig(env);
  const lowerUrl = url.toLowerCase();

  // Check if it's a media file
  for (const ext of MEDIA_EXTENSIONS) {
    if (lowerUrl.includes(ext)) {
      return config.mediaTTL;
    }
  }

  // Check if it's a manifest file
  for (const ext of MANIFEST_EXTENSIONS) {
    if (lowerUrl.includes(ext)) {
      return config.manifestTTL;
    }
  }

  // Default to manifest TTL for unknown types
  return config.manifestTTL;
}

// Build Cache-Control header value
export function buildCacheControl(ttl: number): string {
  if (ttl <= 0) {
    return 'no-cache, no-store, must-revalidate';
  }
  return `public, max-age=${ttl}`;
}

// Get cache key for a URL (for Cloudflare Cache API)
export function getCacheKey(url: string): string {
  // Normalize the URL for caching
  const parsed = new URL(url);
  // Remove any tracking parameters that shouldn't affect caching
  parsed.searchParams.delete('_');
  parsed.searchParams.delete('t');
  parsed.searchParams.delete('timestamp');
  return parsed.toString();
}

// Check if response should be cached
export function shouldCache(response: Response): boolean {
  // Only cache successful responses
  if (!response.ok) {
    return false;
  }

  // Don't cache if explicitly told not to
  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl?.includes('no-store') || cacheControl?.includes('private')) {
    return false;
  }

  return true;
}

// Apply cache headers to response (for Worker)
export function applyCacheHeaders(response: Response, ttl: number): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Cache-Control', buildCacheControl(ttl));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
