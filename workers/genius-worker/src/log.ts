export function logInfo(message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', message, ...fields }))
}

export function logWarn(message: string, fields: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ level: 'warn', message, ...fields }))
}

export function logError(message: string, error: unknown, fields: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? error.message : String(error),
      ...fields,
    })
  )
}