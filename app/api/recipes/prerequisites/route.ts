import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { RECIPE_CACHE_TAGS } from '@/lib/recipes'

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { from_recipe_id, to_recipe_id, skill_label } = body

  if (!from_recipe_id || !to_recipe_id || !String(skill_label ?? '').trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('recipe_prerequisites')
    .insert({ from_recipe_id, to_recipe_id, skill_label: String(skill_label).trim() })
    .select('id, from_recipe_id, to_recipe_id, skill_label')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag(RECIPE_CACHE_TAGS.skillGraph, 'max')
  revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
  return NextResponse.json(data, { status: 201 })
}
