// Environment variables interface for Cloudflare Worker
export interface Env {
  ALLOWED_REFERERS: string;
  ALLOW_EMPTY_REFERER: string;
  CACHE_MEDIA_TTL: string;
  CACHE_MANIFEST_TTL: string;
  [key: string]: string;
}

// Environment variables interface for Express server
export interface ServerEnv {
  ALLOWED_REFERERS?: string;
  ALLOW_EMPTY_REFERER?: string;
  CACHE_MEDIA_TTL?: string;
  CACHE_MANIFEST_TTL?: string;
  PORT?: string;
  [key: string]: string | undefined;
}

// Headers to forward from original request
export const FORWARD_HEADERS = [
  'range',
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'if-none-match',
  'if-modified-since',
] as const;

// Headers to copy from upstream response
export const RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
] as const;

// Media file extensions for caching
export const MEDIA_EXTENSIONS = ['.ts', '.m4s', '.mp4', '.mp3', '.aac', '.webm', '.ogg'] as const;

// Manifest file extensions
export const MANIFEST_EXTENSIONS = ['.m3u8', '.mpd'] as const;

// Proxy request context
export interface ProxyContext {
  targetUrl: string;
  proxyOrigin: string;
  forwardHeaders: Headers;
}

// Cache configuration
export interface CacheConfig {
  mediaTTL: number;
  manifestTTL: number;
}

// Get cache config from environment
export function getCacheConfig(env: Env | ServerEnv): CacheConfig {
  return {
    mediaTTL: parseInt(env.CACHE_MEDIA_TTL || '86400', 10),
    manifestTTL: parseInt(env.CACHE_MANIFEST_TTL || '30', 10),
  };
}

// Build forward headers from request
export function buildForwardHeaders(headers: Headers): Headers {
  const forwardHeaders = new Headers();
  for (const header of FORWARD_HEADERS) {
    const value = headers.get(header);
    if (value) {
      forwardHeaders.set(header, value);
    }
  }
  return forwardHeaders;
}

// Get base URL from a full URL (directory path)
export function getBaseUrl(url: string): string {
  const lastSlash = url.lastIndexOf('/');
  return lastSlash > 0 ? url.substring(0, lastSlash + 1) : url;
}

// Resolve relative URL to absolute
export function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  if (relative.startsWith('/')) {
    const baseUrl = new URL(base);
    return `${baseUrl.origin}${relative}`;
  }
  return getBaseUrl(base) + relative;
}

// Build proxy URL
export function buildProxyUrl(proxyOrigin: string, targetUrl: string): string {
  return `${proxyOrigin}/proxy?url=${encodeURIComponent(targetUrl)}`;
}
