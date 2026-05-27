export class AppError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, options?: { code?: string; cause?: unknown }) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = options?.code

    if (options && 'cause' in options) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}