import { NextRequest, NextResponse } from 'next/server'
import { putR2Object } from '@/lib/r2'
import { isAdminRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidateTag } from 'next/cache'
import { RECIPE_CACHE_TAGS, getRecipeTag } from '@/lib/recipes'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!
const WARDROBE_PUBLIC_URL = process.env.R2_WARDROBE_PUBLIC_URL!
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const recipeSlug = formData.get('recipeSlug') as string | null

    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    if (!recipeSlug) return NextResponse.json({ error: 'Missing recipeSlug' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 })
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 })
    }

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('id')
      .eq('slug', recipeSlug)
      .single()

    if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    const fileId = crypto.randomUUID()
    const extensionMap: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/avif': 'avif',
    }
    const ext = extensionMap[file.type] ?? 'webp'
    const imagePath = `recipes/${recipe.id}/${fileId}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await putR2Object(WARDROBE_BUCKET, imagePath, buffer, file.type, {
      cacheControl: 'public, max-age=31536000, immutable',
    })

    const imageUrl = `https://${WARDROBE_PUBLIC_URL}/${imagePath}`

    // Update the recipe's cover_image field
    await supabaseAdmin
      .from('recipes')
      .update({ cover_image: imageUrl, cover_image_key: imagePath })
      .eq('id', recipe.id)

    revalidateTag(RECIPE_CACHE_TAGS.list, 'max')
    revalidateTag(getRecipeTag(recipeSlug), 'max')

    return NextResponse.json({ url: imageUrl, key: imagePath }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
