/**
 * 一次性脚本：将 Supabase Storage wardrobe bucket 的存量图片迁移到 Cloudflare R2
 *
 * 执行方式：
 *   npx tsx scripts/migrate-images-to-r2.ts
 *
 * 执行前确认：
 *   1. .env.local 中 R2 变量已填写
 *   2. Supabase Storage wardrobe bucket 仍可访问
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
})

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!
const WARDROBE_PUBLIC_URL = process.env.R2_WARDROBE_PUBLIC_URL!

async function listAllFiles(): Promise<string[]> {
  const paths: string[] = []
  // Supabase Storage list 每次最多 100 条，需分页
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from('wardrobe')
      .list('', { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`list root failed: ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      if (item.id) {
        // 根级文件
        paths.push(item.name)
      } else {
        // 子目录（sessionToken）
        let subOffset = 0
        while (true) {
          const { data: sub, error: subErr } = await supabaseAdmin.storage
            .from('wardrobe')
            .list(item.name, { limit: 100, offset: subOffset })
          if (subErr) throw new Error(`list ${item.name} failed: ${subErr.message}`)
          if (!sub || sub.length === 0) break
          for (const f of sub) {
            if (f.id) paths.push(`${item.name}/${f.name}`)
          }
          if (sub.length < 100) break
          subOffset += 100
        }
      }
    }
    if (data.length < 100) break
    offset += 100
  }
  return paths
}

async function main() {
  console.log('开始列举 Supabase Storage wardrobe bucket 中的文件...')
  const paths = await listAllFiles()
  console.log(`共找到 ${paths.length} 个文件`)

  let success = 0
  let failed = 0

  for (const path of paths) {
    try {
      const { data, error } = await supabaseAdmin.storage.from('wardrobe').download(path)
      if (error || !data) throw new Error(error?.message ?? 'download failed')

      const buffer = Buffer.from(await data.arrayBuffer())
      await r2.send(
        new PutObjectCommand({
          Bucket: WARDROBE_BUCKET,
          Key: path,
          Body: buffer,
          ContentType: 'image/webp',
        })
      )

      // 更新 items 表中的 image_url
      const newUrl = `https://${WARDROBE_PUBLIC_URL}/${path}`
      await supabaseAdmin.from('items').update({ image_url: newUrl }).eq('image_path', path)

      console.log(`  ✓ ${path}`)
      success++
    } catch (err) {
      console.error(`  ✗ ${path}: ${err}`)
      failed++
    }
  }

  console.log(`\n迁移完成：成功 ${success}，失败 ${failed}`)
  console.log('验证所有图片可正常访问后，可手动删除 Supabase Storage wardrobe bucket 中的文件。')
}

main().catch(console.error)
