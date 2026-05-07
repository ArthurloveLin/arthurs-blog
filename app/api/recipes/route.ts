import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { RECIPE_CACHE_TAGS } from '@/lib/recipes'

// GET /api/recipes — list all recipes (admin: all; public: published only)
export async function GET(_request: NextRequest) {
  const isAdmin = await isAdminRequest()
  const query = supabaseAdmin
    .from('recipes')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (!isAdmin) query.eq('published', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/recipes — create a new recipe
export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, slug, ...rest } = body

  if (!title || !slug) {
    return NextResponse.json({ error: 'title and slug are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('recipes')
    .insert({ title, slug, ...rest })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
  return NextResponse.json(data, { status: 201 })
}
