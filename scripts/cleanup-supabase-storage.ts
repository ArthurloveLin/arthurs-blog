/**
 * 一次性脚本：删除 Supabase Storage wardrobe bucket 中的存量图片
 * 在确认 R2 图片全部可正常访问后执行
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function listAllFiles(): Promise<{ folder: string; name: string }[]> {
  const files: { folder: string; name: string }[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from('wardrobe')
      .list('', { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`list root failed: ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      if (item.id) {
        files.push({ folder: '', name: item.name })
      } else {
        let subOffset = 0
        while (true) {
          const { data: sub, error: subErr } = await supabaseAdmin.storage
            .from('wardrobe')
            .list(item.name, { limit: 100, offset: subOffset })
          if (subErr) throw new Error(`list ${item.name} failed: ${subErr.message}`)
          if (!sub || sub.length === 0) break
          for (const f of sub) {
            if (f.id) files.push({ folder: item.name, name: f.name })
          }
          if (sub.length < 100) break
          subOffset += 100
        }
      }
    }
    if (data.length < 100) break
    offset += 100
  }
  return files
}

async function main() {
  console.log('列举 Supabase Storage wardrobe bucket 中的文件...')
  const files = await listAllFiles()
  console.log(`共找到 ${files.length} 个文件`)

  const paths = files.map((f) => (f.folder ? `${f.folder}/${f.name}` : f.name))

  // 每次最多删 100 个
  let deleted = 0
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    const { error } = await supabaseAdmin.storage.from('wardrobe').remove(batch)
    if (error) {
      console.error(`删除失败（batch ${i}）：${error.message}`)
    } else {
      deleted += batch.length
      batch.forEach((p) => console.log(`  ✓ ${p}`))
    }
  }

  console.log(`\n完成：共删除 ${deleted} 个文件`)
}

main().catch(console.error)
