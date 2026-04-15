import { after, NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { putR2Object } from '@/lib/r2'
import { isAdminRequest } from '@/lib/auth'
import { processWardrobeItemOcr } from '@/lib/item-ocr'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!
const WARDROBE_PUBLIC_URL = process.env.R2_WARDROBE_PUBLIC_URL!

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const sessionToken = formData.get('sessionToken') as string | null
  const category = formData.get('category') as string | null

  if (!file || !sessionToken) {
    return NextResponse.json({ error: 'Missing file or sessionToken' }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id, template_config')
    .eq('token', sessionToken)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const itemId = crypto.randomUUID()
  const imagePath = `${sessionToken}/${itemId}.webp`

  const arrayBuffer = await file.arrayBuffer()
  const imageBuffer = Buffer.from(arrayBuffer)
  await putR2Object(WARDROBE_BUCKET, imagePath, imageBuffer, 'image/webp')

  const imageUrl = `https://${WARDROBE_PUBLIC_URL}/${imagePath}`
  const isWardrobeTemplate = (session.template_config as { name?: string } | null)?.name === '衣评'

  const { data: item, error: itemError } = await supabaseAdmin
    .from('items')
    .insert({
      id: itemId,
      session_id: session.id,
      image_url: imageUrl,
      image_path: imagePath,
      category: category,
      ocr_status: isWardrobeTemplate ? 'pending' : 'idle',
      ocr_provider: isWardrobeTemplate ? 'baidu' : null,
    })
    .select()
    .single()

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 })
  }

  if (isWardrobeTemplate) {
    after(async () => {
      await processWardrobeItemOcr({ itemId, imageBuffer })
    })
  }

  return NextResponse.json(item, { status: 201 })
}
