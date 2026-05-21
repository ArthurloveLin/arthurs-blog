import { NextRequest, NextResponse } from 'next/server'
import { sendNtfy } from '@/lib/ntfy'

const TOKEN = process.env.DEPLOY_NOTIFY_TOKEN
const TOPIC = 'watchtower-arthur71684'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let sha: string | undefined
  let message: string | undefined
  let container: string | undefined
  let image: string | undefined
  try {
    const body = await req.json()
    sha       = typeof body.sha       === 'string' ? body.sha       : undefined
    message   = typeof body.message   === 'string' ? body.message   : undefined
    container = typeof body.container === 'string' ? body.container : undefined
    image     = typeof body.image     === 'string' ? body.image     : undefined
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const shortSha = sha ? sha.slice(0, 7) : '?'
  const lines = [
    '━━━━━━━━━━━━━━━━━━',
    `✅ 容器: ${container ?? 'arthurs-blog'}`,
    `🐳 镜像: ${image ?? 'ghcr.io/arthurlovelin/arthurs-blog'}`,
    `🔖 提交: ${shortSha}`,
    `📝 内容: ${message ?? '(无描述)'}`,
    '━━━━━━━━━━━━━━━━━━',
  ]

  await sendNtfy(
    TOPIC,
    '🚀 arthurs-blog 部署成功',
    lines.join('\n'),
    { tags: ['white_check_mark'], priority: 3 },
  )

  return NextResponse.json({ ok: true })
}
