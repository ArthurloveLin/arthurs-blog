import { supabaseAdmin } from '@/lib/supabase-admin'

const BAIDU_TOKEN_ENDPOINT = 'https://aip.baidubce.com/oauth/2.0/token'
const BAIDU_GENERAL_OCR_ENDPOINT = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general'

const PRODUCT_INFO_MIN_LENGTH = 8
const PRODUCT_INFO_MAX_LINES = 3
const PRODUCT_INFO_FALLBACK_START_RATIO = 0.58
const PRODUCT_INFO_GAP_TOLERANCE = 26

const PROMO_TEXT_PATTERNS = [
  /官方立减|叠加消费券|会员券|店铺优惠后|优惠前|已享受|可再享|省\d+元|满\d+减\d+|领券购买|加入购物车|去购买|立即抢|超级\d+|已售\s*\d+\+?/i,
  /\d+月\d+日.*(结束|截止|开始)|\d{1,2}:\d{2}|图集|全部|送礼|店铺|客服/i,
  /回头客\d+人|店铺时尚套装回购第\d+名|意趣风|现货|第一批|第二批/i,
]

const PRODUCT_INFO_EXCLUDE_PATTERNS = [
  ...PROMO_TEXT_PATTERNS,
  /^已售\s*\d+/i,
  /^¥\s*\d+/i,
  /^￥\s*\d+/i,
  /^[\d./:\-\s]+$/,
]

const PRICE_CONTEXT_PATTERN = /(?:店铺优惠后|到手价|券后|折后|活动价|售价|价格|现价|优惠前|原价|超级\d+)/i
const PRIMARY_PRICE_PATTERN = /(?:店铺优惠后|到手价|券后|折后|活动价|售价|价格|现价)?\D{0,8}(?:¥|￥)\s*(\d{1,6}(?:\.\d{1,2})?)/i
const ANY_PRICE_PATTERN = /(?:¥|￥)\s*(\d{1,6}(?:\.\d{1,2})?)/g

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  上衣: ['上衣', 't恤', 'T恤', '衬衫', '卫衣', '毛衣', '外套', '夹克', '针织', '背心', '吊带', '西装', '大衣', '羽绒'],
  裤子: ['裤', '牛仔', '短裤', '长裤', '西裤', '阔腿', '半裙', '裙'],
  鞋子: ['鞋', '靴', '凉鞋', '运动鞋', '高跟', '乐福'],
  配饰: ['包', '帽', '耳环', '项链', '戒指', '围巾', '腰带', '墨镜', '手链'],
}

export type ItemOcrStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed'

export interface ItemOcrData {
  rawText: string
  lines: string[]
  locatedLines?: Array<{
    text: string
    top: number
    left: number
    width: number
    height: number
    bottom: number
    right: number
    probability?: number | null
  }>
  suggestedPrice: number | null
  suggestedCategory: string | null
  productInfo: string | null
  provider: 'baidu'
  source: 'upload'
  error?: string
}

interface BaiduTokenResponse {
  access_token?: string
  expires_in?: number
}

interface BaiduOcrResponse {
  error_code?: number
  error_msg?: string
  words_result?: Array<{
    words?: string
    location?: {
      left?: number
      top?: number
      width?: number
      height?: number
    }
    probability?: {
      average?: number
    }
  }>
}

interface OcrLine {
  text: string
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
  probability: number | null
}

let cachedAccessToken: string | null = null
let cachedAccessTokenExpiresAt = 0

function getBaiduCredentials() {
  const apiKey = process.env.BAIDU_OCR_API_KEY
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY

  if (!apiKey || !secretKey) {
    throw new Error('Missing Baidu OCR credentials')
  }

  return { apiKey, secretKey }
}

async function getBaiduAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt) {
    return cachedAccessToken
  }

  const { apiKey, secretKey } = getBaiduCredentials()
  const response = await fetch(
    `${BAIDU_TOKEN_ENDPOINT}?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`,
    { method: 'POST' }
  )

  if (!response.ok) {
    throw new Error(`Failed to get Baidu access token: ${response.status}`)
  }

  const payload = await response.json() as BaiduTokenResponse

  if (!payload.access_token || !payload.expires_in) {
    throw new Error('Baidu OCR token response missing access_token')
  }

  cachedAccessToken = payload.access_token
  cachedAccessTokenExpiresAt = Date.now() + Math.max(payload.expires_in - 300, 60) * 1000

  return cachedAccessToken
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function sortLinesByReadingOrder(lines: OcrLine[]) {
  return [...lines].sort((left, right) => {
    const topDelta = left.top - right.top
    if (Math.abs(topDelta) > 12) return topDelta
    return left.left - right.left
  })
}

function normalizeLines(lines: OcrLine[]) {
  const unique = new Set<string>()

  return lines
    .map((line) => ({
      ...line,
      text: normalizeText(line.text),
    }))
    .filter((line) => {
      if (!line.text) return false
      const dedupeKey = `${line.text}:${Math.round(line.top / 6)}:${Math.round(line.left / 6)}`
      if (unique.has(dedupeKey)) return false
      unique.add(dedupeKey)
      return true
    })
}

function isProductInfoNoise(text: string) {
  return PRODUCT_INFO_EXCLUDE_PATTERNS.some((pattern) => pattern.test(text))
}

function extractPriceValue(text: string) {
  const primaryMatch = text.match(PRIMARY_PRICE_PATTERN)
  if (primaryMatch) {
    const value = Number(primaryMatch[1])
    if (Number.isFinite(value)) return Math.round(value)
  }

  const matches = Array.from(text.matchAll(ANY_PRICE_PATTERN))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 20 && value <= 50000)

  return matches[0] ?? null
}

function pickPriceAnchor(lines: OcrLine[]) {
  const candidates = lines
    .map((line) => {
      const value = extractPriceValue(line.text)
      if (value == null) return null

      let score = 0
      if (PRICE_CONTEXT_PATTERN.test(line.text)) score += 6
      if (/(?:¥|￥)/.test(line.text)) score += 4
      if (line.top > 300) score += 2
      if (line.width > 180) score += 1
      if (/优惠前/.test(line.text)) score -= 3
      if (/已享受|可再享|满\d+减\d+/.test(line.text)) score -= 4

      return { line, value, score }
    })
    .filter((candidate): candidate is { line: OcrLine; value: number; score: number } => candidate !== null)

  if (candidates.length === 0) return null

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    if (right.line.top !== left.line.top) return right.line.top - left.line.top
    return left.line.left - right.line.left
  })

  return candidates[0]
}

function extractSuggestedCategory(lines: OcrLine[]) {
  const joinedText = lines.map((line) => line.text).join(' ')

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => joinedText.includes(keyword))) {
      return category
    }
  }

  return null
}

function buildProductInfo(lines: OcrLine[], priceAnchor: OcrLine | null) {
  const sortedLines = sortLinesByReadingOrder(lines)

  const fallbackTop = sortedLines.length > 0
    ? Math.round(Math.max(...sortedLines.map((line) => line.bottom)) * PRODUCT_INFO_FALLBACK_START_RATIO)
    : 0

  const lowerBound = priceAnchor ? priceAnchor.bottom + Math.max(10, Math.round(priceAnchor.height * 0.5)) : fallbackTop

  const candidates = sortedLines.filter((line) => {
    if (line.top < lowerBound) return false
    if (line.text.length < PRODUCT_INFO_MIN_LENGTH) return false
    if (isProductInfoNoise(line.text)) return false
    return true
  })

  if (candidates.length === 0) return null

  const productLines: OcrLine[] = []

  for (const line of candidates) {
    if (productLines.length === 0) {
      productLines.push(line)
      continue
    }

    const previousLine = productLines[productLines.length - 1]
    const gap = line.top - previousLine.bottom
    if (gap > PRODUCT_INFO_GAP_TOLERANCE) {
      break
    }

    productLines.push(line)
    if (productLines.length >= PRODUCT_INFO_MAX_LINES) {
      break
    }
  }

  const filtered = productLines.map((line) => line.text)

  if (filtered.length === 0) return null

  return filtered.join('\n')
}

async function recognizeTextWithBaidu(imageBuffer: Buffer) {
  const accessToken = await getBaiduAccessToken()
  const body = new URLSearchParams({
    image: imageBuffer.toString('base64'),
    detect_direction: 'true',
    language_type: 'CHN_ENG',
    probability: 'true',
  })

  const response = await fetch(`${BAIDU_GENERAL_OCR_ENDPOINT}?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Baidu OCR request failed: ${response.status}`)
  }

  const payload = await response.json() as BaiduOcrResponse

  if (payload.error_code) {
    throw new Error(payload.error_msg || `Baidu OCR error: ${payload.error_code}`)
  }

  return normalizeLines((payload.words_result ?? []).map((entry) => {
    const location = entry.location ?? {}
    const left = location.left ?? 0
    const top = location.top ?? 0
    const width = location.width ?? 0
    const height = location.height ?? 0

    return {
      text: entry.words ?? '',
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      probability: entry.probability?.average ?? null,
    }
  }))
}

export async function processWardrobeItemOcr({
  itemId,
  imageBuffer,
}: {
  itemId: string
  imageBuffer: Buffer
}) {
  await supabaseAdmin
    .from('items')
    .update({
      ocr_status: 'processing' satisfies ItemOcrStatus,
      ocr_provider: 'baidu',
    })
    .eq('id', itemId)

  try {
    const lines = await recognizeTextWithBaidu(imageBuffer)
    const rawText = lines.map((line) => line.text).join('\n')
    const priceAnchor = pickPriceAnchor(lines)
    const suggestedPrice = priceAnchor?.value ?? null
    const suggestedCategory = extractSuggestedCategory(lines)
    const productInfo = buildProductInfo(lines, priceAnchor?.line ?? null)

    const { data: currentItem, error: currentItemError } = await supabaseAdmin
      .from('items')
      .select('price, category, notes')
      .eq('id', itemId)
      .single()

    if (currentItemError || !currentItem) {
      throw new Error(currentItemError?.message || 'Item not found for OCR update')
    }

    const ocrData: ItemOcrData = {
      rawText,
      lines: lines.map((line) => line.text),
      locatedLines: lines.map((line) => ({
        text: line.text,
        top: line.top,
        left: line.left,
        width: line.width,
        height: line.height,
        bottom: line.bottom,
        right: line.right,
        probability: line.probability,
      })),
      suggestedPrice,
      suggestedCategory,
      productInfo,
      provider: 'baidu',
      source: 'upload',
    }

    const updates: Record<string, unknown> = {
      ocr_status: 'completed' satisfies ItemOcrStatus,
      ocr_provider: 'baidu',
      ocr_data: ocrData,
      ocr_processed_at: new Date().toISOString(),
    }

    if (currentItem.price == null && suggestedPrice != null) {
      updates.price = suggestedPrice
    }
    if (!currentItem.category && suggestedCategory) {
      updates.category = suggestedCategory
    }
    if (!currentItem.notes && productInfo) {
      updates.notes = productInfo
    }

    const { error: updateError } = await supabaseAdmin
      .from('items')
      .update(updates)
      .eq('id', itemId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR failed'

    await supabaseAdmin
      .from('items')
      .update({
        ocr_status: 'failed' satisfies ItemOcrStatus,
        ocr_provider: 'baidu',
        ocr_data: {
          rawText: '',
          lines: [],
          locatedLines: [],
          suggestedPrice: null,
          suggestedCategory: null,
          productInfo: null,
          provider: 'baidu',
          source: 'upload',
          error: message,
        } satisfies ItemOcrData,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq('id', itemId)
  }
}