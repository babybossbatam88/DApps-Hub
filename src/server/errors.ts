import 'server-only'
import type { ErrorCode } from '@/types/sourced'
import { ERROR_COPY } from '@/types/sourced'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'

/**
 * Application errors carry a code from the product's taxonomy, so a route can
 * translate any failure into a response the UI knows how to render — rather
 * than a 500 with a stack trace the user cannot act on.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message ?? ERROR_COPY[code])
    this.name = 'AppError'
  }
}

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown }
}

export function toApiError(error: unknown): { body: ApiErrorBody; status: number } {
  if (error instanceof AppError) {
    return {
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      status: error.status,
    }
  }

  const message = extractMessage(error)

  // A missing DATABASE_URL is a deployment problem, not a bug, and saying so
  // saves the reader from debugging the query layer.
  if (message.includes('DATABASE_URL is not set')) {
    return {
      body: { error: { code: 'DATABASE_UNAVAILABLE', message } },
      status: 503,
    }
  }
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('Can\'t reach database') ||
    message.includes('database server')
  ) {
    return {
      body: {
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: `The database is unreachable: ${message}`,
        },
      },
      status: 503,
    }
  }

  const rpcCode = classifyRpcError(error)
  if (rpcCode !== 'UNKNOWN') {
    return { body: { error: { code: rpcCode, message } }, status: 503 }
  }

  return { body: { error: { code: 'UNKNOWN', message } }, status: 500 }
}
