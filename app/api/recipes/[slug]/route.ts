import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { RECIPE_CACHE_TAGS, RECIPE_DETAIL_SELECT, RECIPE_LIST_SELECT, getRecipeTag } from '@/lib/recipes'

type Params = { params: Promise<{ slug: string }> }

// GET /api/recipes/[slug]
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const isAdmin = await isAdminRequest()

  const query = supabaseAdmin.from('recipes').select(RECIPE_DETAIL_SELECT).eq('slug', slug).single()

  const { data, error } = await query
  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data.published && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PATCH /api/recipes/[slug] — update a recipe
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const body = await request.json()

  // Strip immutable fields before update
  const updateData = Object.fromEntries(
    Object.entries(body).filter(([k]) => !['slug', 'id', 'created_at'].includes(k))
  )

  // If publishing for the first time, set published_at
  if (updateData.published === true) {
    const { data: existing } = await supabaseAdmin
      .from('recipes')
      .select('published_at, published')
      .eq('slug', slug)
      .single()

    if (existing && !existing.published_at) {
      updateData.published_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabaseAdmin
    .from('recipes')
    .update(updateData)
    .eq('slug', slug)
    .select(RECIPE_LIST_SELECT)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
  revalidateTag(RECIPE_CACHE_TAGS.skillGraph, 'max')
  revalidateTag(getRecipeTag(slug), 'max')
  return NextResponse.json(data)
}

// DELETE /api/recipes/[slug]
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  const { error } = await supabaseAdmin
    .from('recipes')
    .delete()
    .eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
  revalidateTag(RECIPE_CACHE_TAGS.skillGraph, 'max')
  revalidateTag(getRecipeTag(slug), 'max')
  return new NextResponse(null, { status: 204 })
}
