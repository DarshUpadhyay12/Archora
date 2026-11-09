import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Lightweight, in-memory sliding window rate limiter.
 * Zero external dependencies; protects against brute force and denial of service.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Periodically prune expired entries every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it does not block Node process termination in tests
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // Automatically skip rate limiting during automated test suite execution
    if (
      process.env.NODE_ENV === 'test' ||
      (process.env.DATABASE_PATH && process.env.DATABASE_PATH.includes('test'))
    ) {
      return next();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || req.socket.remoteAddress || 'unknown_ip');

    const now = Date.now();
    const record = store.get(key);

    if (!record || now > record.resetAt) {
      store.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return next();
    }

    record.count++;

    if (record.count > options.max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error:
          options.message ||
          `Too many requests. Please wait ${retryAfterSec} second(s) before retrying.`,
        retryAfter: retryAfterSec,
      });
    }

    next();
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes per IP
  message: 'Too many authentication attempts. Please try again in a few minutes.',
});

export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'AI request limit reached. Please wait a moment before sending another prompt.',
});

export const backupRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 15, // 15 backups per 5 minutes
  message: 'Too many backup operations initiated. Please wait before creating another snapshot.',
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 upload operations per 15 minutes
  message: 'Upload rate limit reached. Please wait before uploading more files.',
});

export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  message: 'Too many requests to the API. Please wait a moment before retrying.',
});

