const NTFY_BASE_URL = process.env.NTFY_INTERNAL_URL ?? 'http://localhost:40265'
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? 'memo-reminder'
const NTFY_TOKEN = process.env.NTFY_TOKEN

function ntfyHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (NTFY_TOKEN) headers['Authorization'] = `Bearer ${NTFY_TOKEN}`
  return headers
}

export async function sendNtfy(
  topic: string,
  title: string,
  body: string,
  options?: { priority?: number; tags?: string[]; clickUrl?: string },
): Promise<void> {
  const payload: Record<string, unknown> = {
    topic,
    title,
    message: body,
    priority: options?.priority ?? 3,
  }
  if (options?.tags?.length) payload.tags = options.tags
  if (options?.clickUrl) payload.click = options.clickUrl

  const response = await fetch(NTFY_BASE_URL, {
    method: 'POST',
    headers: ntfyHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`ntfy send failed: ${response.status}`)
  }
}

export async function sendNtfyReminder(title: string, body: string, clickUrl?: string) {
  const payload: Record<string, unknown> = {
    topic: NTFY_TOPIC,
    title,
    message: body,
    tags: ['alarm_clock'],
    priority: 4,
  }

  if (clickUrl) {
    payload.click = clickUrl
  }

  const response = await fetch(NTFY_BASE_URL, {
    method: 'POST',
    headers: ntfyHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`ntfy send failed: ${response.status}`)
  }
}
