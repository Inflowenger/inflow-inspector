import type { ApiError } from './types'

/**
 * Custom error class for API errors with typed status and optional response data.
 */
export class ApiRequestError extends Error {
  public status: number
  public statusText: string
  public data?: unknown

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.status = error.status
    this.statusText = error.statusText
    this.data = error.data
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }

  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isTimeout(): boolean {
    return this.status === 0 && this.statusText === 'Timeout'
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  get isUnprocessable(): boolean {
    return this.status === 422
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }
}

/**
 * Wraps raw API errors into typed ApiRequestError instances.
 */
export function toApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  ) {
    return new ApiRequestError(error as ApiError)
  }
  return new ApiRequestError({
    message: error instanceof Error ? error.message : 'Unknown error',
    status: 0,
    statusText: 'UnknownError',
  })
}