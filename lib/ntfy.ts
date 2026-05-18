const NTFY_URL = process.env.NTFY_INTERNAL_URL ?? 'http://localhost:40265'
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? 'memo-reminder'

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

  const response = await fetch(NTFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`ntfy send failed: ${response.status}`)
  }
}
