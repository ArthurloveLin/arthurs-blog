const NTFY_URL = process.env.NTFY_INTERNAL_URL ?? 'http://localhost:40265'
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? 'memo-reminder'

export async function sendNtfyReminder(title: string, body: string, clickUrl?: string) {
  const headers: Record<string, string> = {
    'Title': title,
    'Tags': 'alarm_clock',
    'Priority': 'high',
    'Content-Type': 'text/plain',
  }

  if (clickUrl) {
    headers['Click'] = clickUrl
  }

  const response = await fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
    method: 'POST',
    headers,
    body,
  })

  if (!response.ok) {
    throw new Error(`ntfy send failed: ${response.status}`)
  }
}
