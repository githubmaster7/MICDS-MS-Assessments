import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Limiter definitions
// ---------------------------------------------------------------------------

/** 5 login attempts per 15 minutes per IP */
export const loginLimiter = new RateLimiterMemory({
  keyPrefix:   'login',
  points:      5,
  duration:    60 * 15,
  blockDuration: 60 * 15,
})

/** 3 signup requests per hour per IP */
export const signupLimiter = new RateLimiterMemory({
  keyPrefix:   'signup',
  points:      3,
  duration:    60 * 60,
  blockDuration: 60 * 60,
})

/** 10 email verification attempts per hour per IP */
export const emailVerifyLimiter = new RateLimiterMemory({
  keyPrefix:   'email_verify',
  points:      10,
  duration:    60 * 60,
})

/** 100 general API calls per minute per user/IP */
export const apiLimiter = new RateLimiterMemory({
  keyPrefix:   'api',
  points:      100,
  duration:    60,
})

/** 10 bulk grading operations per minute per teacher */
export const bulkGradingLimiter = new RateLimiterMemory({
  keyPrefix:   'bulk_grading',
  points:      10,
  duration:    60,
})

/** 5 rotation operations per hour per admin */
export const rotationLimiter = new RateLimiterMemory({
  keyPrefix:   'rotation',
  points:      5,
  duration:    60 * 60,
})

/** 30 signup approve/reject actions per minute per admin */
export const adminApprovalLimiter = new RateLimiterMemory({
  keyPrefix:   'admin_approval',
  points:      30,
  duration:    60,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RateLimiterInstance = RateLimiterMemory

export interface RateLimitResult {
  success: boolean
  remainingPoints: number
  msBeforeNext: number
}

// ---------------------------------------------------------------------------
// Core consume helper
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  limiter: RateLimiterInstance,
  key: string,
): Promise<RateLimitResult> {
  try {
    const res = await limiter.consume(key)
    return {
      success:         true,
      remainingPoints: res.remainingPoints,
      msBeforeNext:    res.msBeforeNext,
    }
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return {
        success:         false,
        remainingPoints: 0,
        msBeforeNext:    err.msBeforeNext,
      }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Route handler helper
// ---------------------------------------------------------------------------

/**
 * withRateLimit wraps a Next.js App Router handler with rate limiting.
 *
 * @example
 * export const POST = withRateLimit(loginLimiter, async (req) => { ... })
 */
export function withRateLimit(
  limiter: RateLimiterInstance,
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    const result = await checkRateLimit(limiter, ip)

    if (!result.success) {
      const retryAfterSecs = Math.ceil(result.msBeforeNext / 1000)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After':       String(retryAfterSecs),
            'X-RateLimit-Reset': String(Date.now() + result.msBeforeNext),
          },
        },
      )
    }

    const response = await handler(req, ...args)
    response.headers.set('X-RateLimit-Remaining', String(result.remainingPoints))
    return response
  }
}

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

/** Build a per-user key for authenticated routes */
export function userRateLimitKey(userId: string): string {
  return `user:${userId}`
}

/** Build a per-IP key */
export function ipRateLimitKey(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
