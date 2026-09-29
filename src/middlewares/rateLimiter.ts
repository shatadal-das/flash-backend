import { Request, Response, NextFunction } from "express";
import { checkRateLimit } from "../services/redis.service";

interface RateLimiterOptions {
  maxRequests?: number;
  windowSeconds?: number;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiter middleware factory backed by Redis sliding window.
 */
export function rateLimiter(options: RateLimiterOptions = {}) {
  const {
    maxRequests = 100,
    windowSeconds = 60,
    keyGenerator = (req: Request) => req.ip || "unknown",
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = keyGenerator(req);
      const { allowed, remaining, retryAfterSeconds } = await checkRateLimit(
        identifier,
        maxRequests,
        windowSeconds
      );

      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", remaining);

      if (!allowed) {
        res.setHeader("Retry-After", retryAfterSeconds);
        res.status(429).json({
          success: false,
          error: {
            message: "Too many requests, please try again later.",
            retryAfterSeconds,
          },
        });
        return;
      }

      next();
    } catch (error) {
      // If Redis is down, allow the request through
      console.error("Rate limiter error, allowing request:", error);
      next();
    }
  };
}
