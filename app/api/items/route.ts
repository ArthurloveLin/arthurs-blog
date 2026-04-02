import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const sessionToken = formData.get('sessionToken') as string | null
  const category = formData.get('category') as string | null

  if (!file || !sessionToken) {
    return NextResponse.json({ error: 'Missing file or sessionToken' }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('token', sessionToken)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const itemId = crypto.randomUUID()
  const imagePath = `${sessionToken}/${itemId}.webp`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from('wardrobe')
    .upload(imagePath, arrayBuffer, {
      contentType: 'image/webp',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('wardrobe')
    .getPublicUrl(imagePath)

  const { data: item, error: itemError } = await supabaseAdmin
    .from('items')
    .insert({
      id: itemId,
      session_id: session.id,
      image_url: publicUrl,
      image_path: imagePath,
      category: category,
    })
    .select()
    .single()

  if (itemError) {
    await supabaseAdmin.storage.from('wardrobe').remove([imagePath])
    return NextResponse.json({ error: itemError.message }, { status: 500 })
  }

  return NextResponse.json(item, { status: 201 })
}
