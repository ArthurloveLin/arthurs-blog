import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'
import { RECIPE_REVISION_SELECT, getRecipeRevisionsTag } from '@/lib/recipes'

type Params = { params: Promise<{ slug: string }> }

// GET /api/recipes/[slug]/revisions
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params

  const { data: recipe, error: recipeError } = await supabaseAdmin
    .from('recipes')
    .select('id, published')
    .eq('slug', slug)
    .single()

  if (recipeError || !recipe) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isAdmin = await isAdminRequest()
  if (!recipe.published && !isAdmin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('recipe_revisions')
    .select(RECIPE_REVISION_SELECT)
    .eq('recipe_id', recipe.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/recipes/[slug]/revisions — add a revision entry
export async function POST(request: NextRequest, { params }: Params) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const { version, change_summary } = await request.json()

  if (!version || !change_summary) {
    return NextResponse.json({ error: 'version and change_summary are required' }, { status: 400 })
  }

  const { data: recipe, error: recipeError } = await supabaseAdmin
    .from('recipes')
    .select('id')
    .eq('slug', slug)
    .single()

  if (recipeError || !recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('recipe_revisions')
    .insert({ recipe_id: recipe.id, version, change_summary })
    .select(RECIPE_REVISION_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag(getRecipeRevisionsTag(recipe.id), 'max')
  return NextResponse.json(data, { status: 201 })
}
