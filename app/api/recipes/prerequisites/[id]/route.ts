import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { RECIPE_CACHE_TAGS } from '@/lib/recipes'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('recipe_prerequisites')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag(RECIPE_CACHE_TAGS.skillGraph, 'max')
  revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
  return new NextResponse(null, { status: 204 })
}
