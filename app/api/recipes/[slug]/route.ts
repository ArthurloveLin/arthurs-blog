import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { RECIPE_CACHE_TAGS, RECIPE_DETAIL_SELECT, RECIPE_LIST_SELECT, getRecipeRevisionsTag, getRecipeTag } from '@/lib/recipes'

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
  const changeSummary = typeof body.change_summary === 'string' ? body.change_summary.trim() : ''

  // Strip immutable fields before update
  const updateData = Object.fromEntries(
    Object.entries(body).filter(([k]) => !['slug', 'id', 'created_at', 'change_summary'].includes(k))
  )

  if (typeof updateData.version === 'string') {
    updateData.version = updateData.version.trim()
    if (!updateData.version) {
      return NextResponse.json({ error: 'version cannot be empty' }, { status: 400 })
    }
  }

  const { data: existingRecipe, error: existingRecipeError } = await supabaseAdmin
    .from('recipes')
    .select(RECIPE_DETAIL_SELECT)
    .eq('slug', slug)
    .single()

  if (existingRecipeError || !existingRecipe) {
    if (existingRecipeError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ error: existingRecipeError?.message ?? 'Not found' }, { status: 500 })
  }

  const versionChanged = typeof updateData.version === 'string' && updateData.version !== existingRecipe.version

  if (versionChanged && !changeSummary) {
    return NextResponse.json({ error: 'change_summary is required when version changes' }, { status: 400 })
  }

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

  if (versionChanged) {
    const { error: revisionError } = await supabaseAdmin
      .from('recipe_revisions')
      .insert({
        recipe_id: existingRecipe.id,
        version: existingRecipe.version,
        change_summary: changeSummary,
        snapshot: existingRecipe,
      })

    if (revisionError) {
      return NextResponse.json({ error: revisionError.message }, { status: 500 })
    }
  }

  revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
  revalidateTag(RECIPE_CACHE_TAGS.skillGraph, 'max')
  revalidateTag(getRecipeTag(slug), 'max')
  revalidateTag(getRecipeRevisionsTag(existingRecipe.id), 'max')
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
