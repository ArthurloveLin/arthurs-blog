import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { TEMPLATES, DEFAULT_TEMPLATE } from '@/lib/templates'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*, items(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, note, budget, template_id, template_config } = await request.json() as Record<string, unknown>
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  
  const selectedTemplateId = (template_id as string | undefined) || DEFAULT_TEMPLATE
  const finalTemplateConfig = template_config || TEMPLATES[selectedTemplateId] || TEMPLATES[DEFAULT_TEMPLATE]

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({ 
      title: title || null, 
      note: note || null, 
      budget: budget || null, 
      token,
      template_id: selectedTemplateId,
      template_config: finalTemplateConfig
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('sessions', 'max')
  return NextResponse.json(data, { status: 201 })
}
