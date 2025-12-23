import type { Env, ServerEnv } from '../core/types.js';
import type { Request as ExpressRequest } from 'express';

// Validate Referer header against whitelist (for Worker)
export function validateReferer(request: Request, env: Env): boolean {
  const referer = request.headers.get('Referer');
  return validateRefererValue(referer, env.ALLOWED_REFERERS, env.ALLOW_EMPTY_REFERER === 'true');
}

// Validate Referer for Express request
export function validateExpressReferer(req: ExpressRequest): boolean {
  const referer = req.headers.referer || req.headers.referrer;
  const allowedReferers = process.env.ALLOWED_REFERERS || '';
  const allowEmpty = process.env.ALLOW_EMPTY_REFERER === 'true';
  return validateRefererValue(referer as string | undefined, allowedReferers, allowEmpty);
}

// Core referer validation logic
function validateRefererValue(
  referer: string | undefined | null,
  allowedReferers: string,
  allowEmpty: boolean
): boolean {
  // Handle empty referer
  if (!referer) {
    return allowEmpty;
  }

  // Parse allowed referers
  const patterns = allowedReferers.split(',').map(s => s.trim()).filter(Boolean);

  // If no patterns configured, deny all (except empty if allowed)
  if (patterns.length === 0) {
    return allowEmpty;
  }

  // Extract hostname from referer
  let refererHost: string;
  try {
    refererHost = new URL(referer).hostname;
  } catch {
    return false;
  }

  // Check against patterns
  return patterns.some(pattern => {
    // Wildcard pattern (e.g., *.example.com)
    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(2);
      return refererHost === domain || refererHost.endsWith('.' + domain);
    }

    // Exact URL pattern - extract hostname
    try {
      const patternHost = new URL(pattern).hostname;
      return refererHost === patternHost;
    } catch {
      // Treat as hostname if not a valid URL
      return refererHost === pattern;
    }
  });
}
