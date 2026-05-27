import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser, isAdminRequest } from '@/lib/auth'
import { AppError, isAppError } from '@/lib/app-error'

export async function requireAdminUser() {
  if (!await isAdminRequest()) {
    throw new AppError(403, 'Forbidden')
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(401, 'Unauthorized')
  }

  return user
}

export async function readJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(
  request: NextRequest
): Promise<T> {
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new AppError(400, 'Request body must be a JSON object')
    }

    return body as T
  } catch (error) {
    if (isAppError(error)) {
      throw error
    }

    throw new AppError(400, 'Invalid JSON body', { cause: error })
  }
}

export async function readOptionalJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(
  request: NextRequest
): Promise<T> {
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return {} as T
    }

    return body as T
  } catch {
    return {} as T
  }
}

export function getOptionalSearchParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key)?.trim()
  return value && value.length > 0 ? value : null
}

export function asRequiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, `${field} must be a non-empty string`)
  }

  return value.trim()
}

export function asOptionalString(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new AppError(400, `${field} must be a string`)
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function asOptionalRecord(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, `${field} must be an object`)
  }

  return value as Record<string, unknown>
}

export function asOptionalStringArray(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new AppError(400, `${field} must be a string array`)
  }

  return value.map((item) => item.trim())
}

export function getPositiveIntegerSearchParam(
  request: NextRequest,
  key: string,
  fallback: number,
  max = 100
) {
  const raw = getOptionalSearchParam(request, key)
  if (!raw) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(400, `${key} must be a positive integer`)
  }

  return Math.min(parsed, max)
}

export function handleApiError(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code ?? null,
      },
      { status: error.status }
    )
  }

  const message = error instanceof Error ? error.message : 'Internal Server Error'
  return NextResponse.json({ error: message }, { status: 500 })
}