import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type ItemKind = 'food' | 'reference'

interface ExportedNutrition {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  weight_g: number | null
}

interface ExportedItem {
  id: string
  kind: ItemKind
  canonicalName: string
  aliases: string[]
  unit: string | null
  source: string | null
  notes: string | null
  section: string | null
  subsection: string | null
  headingPath: string[]
  nutrition: ExportedNutrition
  approximateFields: string[]
  raw: Record<string, string>
}

interface ExportedTable {
  headingPath: string[]
  columns: string[]
  rowCount: number
}

interface ExportedKnowledgeBase {
  version: string | null
  lastUpdated: string | null
  updateNote: string | null
  sourceMarkdownPath: string
  sourceMarkdownSha256: string
  exportedAt: string
  itemCount: number
  foodItemCount: number
  referenceItemCount: number
  tables: ExportedTable[]
  items: ExportedItem[]
}

interface ParsedArgs {
  input: string
  output: string
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(CURRENT_DIR, '..')
const DEFAULT_INPUT = resolve(REPO_ROOT, 'ClaudeDesign/calorie/calorie-db.md')
const DEFAULT_OUTPUT = resolve(REPO_ROOT, 'ClaudeDesign/calorie/calorie-db.json')

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  let input = DEFAULT_INPUT
  let output = DEFAULT_OUTPUT

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]

    if ((value === '--input' || value === '-i') && args[index + 1]) {
      input = resolve(process.cwd(), args[index + 1])
      index += 1
      continue
    }

    if ((value === '--output' || value === '-o') && args[index + 1]) {
      output = resolve(process.cwd(), args[index + 1])
      index += 1
    }
  }

  return { input, output }
}

function splitMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isSeparatorRow(line: string) {
  const cells = splitMarkdownRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function stripInlineFormatting(value: string) {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim()
}

function normalizeNullableText(value: string | undefined) {
  const normalized = stripInlineFormatting(value ?? '')
  if (!normalized || normalized === '—') {
    return null
  }
  return normalized
}

function parseNumericField(value: string | undefined) {
  const normalized = stripInlineFormatting(value ?? '')
  if (!normalized || normalized === '—') {
    return { value: null, approximate: false }
  }

  const approximate = /[~≈]/.test(normalized)
  const match = normalized.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) {
    return { value: null, approximate }
  }

  return { value: Number.parseFloat(match[0]), approximate }
}

function extractAliases(name: string) {
  const aliases = new Set<string>()
  const normalizedName = stripInlineFormatting(name)
  if (normalizedName) {
    aliases.add(normalizedName)
  }

  const withoutParentheses = normalizedName.replace(/[（(][^（）()]+[）)]/g, '').trim()
  if (withoutParentheses && withoutParentheses !== normalizedName) {
    aliases.add(withoutParentheses)
  }

  for (const segment of normalizedName.split('/')) {
    const trimmed = segment.trim()
    if (trimmed) {
      aliases.add(trimmed)
    }
  }

  for (const match of normalizedName.matchAll(/[（(]([^（）()]+)[）)]/g)) {
    const candidate = match[1]?.trim()
    if (candidate && /[A-Za-z]/.test(candidate)) {
      aliases.add(candidate)
    }
  }

  return [...aliases]
}

function createItemId(headingPath: string[], canonicalName: string, unit: string | null) {
  return createHash('sha1')
    .update(`${headingPath.join('>')}|${canonicalName}|${unit ?? ''}`)
    .digest('hex')
    .slice(0, 16)
}

function buildNutrition(raw: Record<string, string>) {
  const approximateFields: string[] = []
  const nutrition: ExportedNutrition = {
    calories: null,
    protein_g: null,
    fat_g: null,
    carbs_g: null,
    fiber_g: null,
    sugar_g: null,
    sodium_mg: null,
    weight_g: null,
  }

  for (const [column, rawValue] of Object.entries(raw)) {
    const parsed = parseNumericField(rawValue)
    const normalizedColumn = column.replace(/\s+/g, '')

    if (normalizedColumn.includes('热量')) {
      nutrition.calories = parsed.value
      if (parsed.approximate) approximateFields.push('calories')
      continue
    }

    if (normalizedColumn.includes('蛋白质')) {
      nutrition.protein_g = parsed.value
      if (parsed.approximate) approximateFields.push('protein_g')
      continue
    }

    if (normalizedColumn.includes('脂肪')) {
      nutrition.fat_g = parsed.value
      if (parsed.approximate) approximateFields.push('fat_g')
      continue
    }

    if (normalizedColumn.includes('碳水')) {
      nutrition.carbs_g = parsed.value
      if (parsed.approximate) approximateFields.push('carbs_g')
      continue
    }

    if (normalizedColumn.includes('膳食纤维')) {
      nutrition.fiber_g = parsed.value
      if (parsed.approximate) approximateFields.push('fiber_g')
      continue
    }

    if (normalizedColumn === '糖(g)' || normalizedColumn.includes('游离糖')) {
      nutrition.sugar_g = parsed.value
      if (parsed.approximate) approximateFields.push('sugar_g')
      continue
    }

    if (normalizedColumn.includes('钠')) {
      nutrition.sodium_mg = parsed.value
      if (parsed.approximate) approximateFields.push('sodium_mg')
      continue
    }

    if (normalizedColumn.includes('重量') || normalizedColumn.includes('克重')) {
      nutrition.weight_g = parsed.value
      if (parsed.approximate) approximateFields.push('weight_g')
    }
  }

  return {
    nutrition,
    approximateFields: [...new Set(approximateFields)],
  }
}

function parseVersion(lines: string[]) {
  const versionLine = lines.find((line) => line.startsWith('> 版本：')) ?? ''
  const updateLine = lines.find((line) => line.startsWith('> **')) ?? ''

  return {
    version: versionLine.match(/版本：([^|]+)/)?.[1]?.trim() ?? null,
    lastUpdated: versionLine.match(/最后更新：([^|]+)/)?.[1]?.trim() ?? null,
    updateNote: updateLine.replace(/^>\s*/, '').trim() || null,
  }
}

function exportKnowledge(markdown: string, inputPath: string): ExportedKnowledgeBase {
  const lines = markdown.split(/\r?\n/)
  const meta = parseVersion(lines)

  let currentSection: string | null = null
  let currentSubsection: string | null = null
  const tables: ExportedTable[] = []
  const items: ExportedItem[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()

    if (line.startsWith('## ')) {
      currentSection = stripInlineFormatting(line.slice(3))
      currentSubsection = null
      continue
    }

    if (line.startsWith('### ')) {
      currentSubsection = stripInlineFormatting(line.slice(4))
      continue
    }

    if (!line.startsWith('|')) {
      continue
    }

    const headerLine = line
    const separatorLine = lines[index + 1]?.trim() ?? ''
    if (!separatorLine.startsWith('|') || !isSeparatorRow(separatorLine)) {
      continue
    }

    const columns = splitMarkdownRow(headerLine)
    const headingPath = [currentSection, currentSubsection].filter((segment): segment is string => Boolean(segment))
    let rowCount = 0

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowLine = lines[rowIndex].trim()
      if (!rowLine.startsWith('|')) {
        break
      }

      const values = splitMarkdownRow(rowLine)
      if (values.length !== columns.length) {
        continue
      }

      const raw = Object.fromEntries(columns.map((column, columnIndex) => [column, values[columnIndex] ?? '']))
      const nameColumn = columns.includes('食物') ? '食物' : columns[0]
      const canonicalName = stripInlineFormatting(raw[nameColumn] ?? '')
      if (!canonicalName) {
        continue
      }

      const { nutrition, approximateFields } = buildNutrition(raw)
      const unit = normalizeNullableText(raw['单位'])
      const item: ExportedItem = {
        id: createItemId(headingPath, canonicalName, unit),
        kind: columns.includes('食物') ? 'food' : 'reference',
        canonicalName,
        aliases: extractAliases(canonicalName),
        unit,
        source: normalizeNullableText(raw['来源']),
        notes: normalizeNullableText(raw['备注']),
        section: currentSection,
        subsection: currentSubsection,
        headingPath,
        nutrition,
        approximateFields,
        raw,
      }

      items.push(item)
      rowCount += 1
    }

    tables.push({
      headingPath,
      columns,
      rowCount,
    })

    index += rowCount + 1
  }

  const sourceMarkdownSha256 = createHash('sha256').update(markdown).digest('hex')
  const foodItemCount = items.filter((item) => item.kind === 'food').length
  const referenceItemCount = items.length - foodItemCount

  return {
    version: meta.version,
    lastUpdated: meta.lastUpdated,
    updateNote: meta.updateNote,
    sourceMarkdownPath: inputPath,
    sourceMarkdownSha256,
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    foodItemCount,
    referenceItemCount,
    tables,
    items,
  }
}

async function main() {
  const { input, output } = parseArgs()
  const markdown = await readFile(input, 'utf8')
  const exported = exportKnowledge(markdown, input)

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(exported, null, 2)}\n`, 'utf8')

  console.log(`Exported ${exported.itemCount} calorie records to ${output}`)
  console.log(`Version: ${exported.version ?? 'unknown'} | Updated: ${exported.lastUpdated ?? 'unknown'}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})