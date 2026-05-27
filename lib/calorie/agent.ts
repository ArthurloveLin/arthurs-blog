import 'server-only'

import { readFile } from 'node:fs/promises'

import { cache } from 'react'

import type {
  AgentParsedResult,
  AgentPromptContext,
  AgentRuntimeAdapter,
  CalorieDraftPayload,
} from '@/lib/agent-runtime/contracts'
import { extractJsonObjectFromText, validateCalorieDraftPayload } from '@/lib/agent-runtime/validation'
import { findCalorieKnowledgeMatches, getCalorieKnowledgeMetadata } from '@/lib/calorie/knowledge'
import type { CalorieKnowledgeNutrition } from '@/lib/calorie/knowledge'

const CALORIE_INSTRUCTION_PATH = '/home/arthur/repositories/arthurs-blog/ClaudeDesign/calorie/instruction.md'
const CALORIE_PROMPT_VERSION = 'calorie-workspace-v1'
const MAX_CONTEXT_MESSAGES = 8
const MAX_KNOWLEDGE_MATCHES = 8

const readCalorieInstruction = cache(async () => readFile(CALORIE_INSTRUCTION_PATH, 'utf8'))

function formatNutrition(nutrition: CalorieKnowledgeNutrition) {
  return [
    `kcal=${nutrition.calories ?? 'null'}`,
    `protein=${nutrition.protein_g ?? 'null'}`,
    `fat=${nutrition.fat_g ?? 'null'}`,
    `carbs=${nutrition.carbs_g ?? 'null'}`,
    `fiber=${nutrition.fiber_g ?? 'null'}`,
    `sugar=${nutrition.sugar_g ?? 'null'}`,
    `sodium=${nutrition.sodium_mg ?? 'null'}`,
    `weight=${nutrition.weight_g ?? 'null'}`,
  ].join(', ')
}

function renderMessageContext(context: AgentPromptContext) {
  const recentMessages = context.messages.slice(-MAX_CONTEXT_MESSAGES)
  if (recentMessages.length === 0) {
    return '无历史消息。'
  }

  return recentMessages
    .map((message) => {
      const textContent = message.text_content?.trim() || '(无文本，见 structured_content 或附件)'
      return `- [${message.role}] ${textContent}`
    })
    .join('\n')
}

function renderAttachments(context: AgentPromptContext) {
  if (context.attachments.length === 0) {
    return '无附件。'
  }

  return context.attachments
    .map((attachment) => `- ${attachment.attachmentId} | ${attachment.mediaType} | ${attachment.absolutePath}`)
    .join('\n')
}

async function renderKnowledgeContext(query: string | null) {
  if (!query) {
    return {
      knowledgeText: '无直接命中，按通用营养常识估算。',
      knowledgeVersion: null,
    }
  }

  const [matches, metadata] = await Promise.all([
    findCalorieKnowledgeMatches(query, MAX_KNOWLEDGE_MATCHES),
    getCalorieKnowledgeMetadata(),
  ])

  if (matches.length === 0) {
    return {
      knowledgeText: `知识库版本 ${metadata.version ?? 'unknown'} 未命中相关条目。`,
      knowledgeVersion: metadata.sourceMarkdownSha256,
    }
  }

  const rows = matches.map((item) => {
    const aliases = item.aliases.length > 0 ? ` aliases=${item.aliases.join('/')}` : ''
    return `- ${item.canonicalName}${aliases} | ${formatNutrition(item.nutrition)} | source=${item.source ?? 'unknown'}`
  })

  return {
    knowledgeText: `知识库版本 ${metadata.version ?? 'unknown'}:\n${rows.join('\n')}`,
    knowledgeVersion: metadata.sourceMarkdownSha256,
  }
}

function buildResponseSchemaExample() {
  return `{
  "schemaVersion": "calorie-draft-v1",
  "date": "2026-05-27",
  "summary": "一句话总结本次录入后的进度与建议。",
  "insights": ["要点 1", "要点 2"],
  "totals": {
    "calories": 0,
    "protein_g": 0,
    "fat_g": 0,
    "carbs_g": 0,
    "fiber_g": null,
    "sugar_g": null,
    "sodium_mg": null
  },
  "meals": [
    {
      "meal_type": "lunch",
      "meal_label": "午餐",
      "occurred_at": "2026-05-27T12:30:00+08:00",
      "items": [
        {
          "food_name": "鸡胸肉沙拉",
          "food_alias": null,
          "quantity_text": "1 份",
          "grams": 300,
          "calories": 420,
          "protein_g": 35,
          "fat_g": 12,
          "carbs_g": 30,
          "fiber_g": 6,
          "sugar_g": 4,
          "sodium_mg": 620,
          "estimate_level": "database",
          "source_kind": "knowledge_db",
          "confidence_score": 0.87,
          "needs_review": true,
          "source_ref": {"note": "可选说明"}
        }
      ]
    }
  ]
}`
}

function buildAssistantMessage(payload: CalorieDraftPayload) {
  if (payload.insights.length === 0) {
    return payload.summary
  }

  return `${payload.summary}\n\n${payload.insights.map((insight) => `- ${insight}`).join('\n')}`
}

export const calorieWorkspaceAgentAdapter: AgentRuntimeAdapter<CalorieDraftPayload> = {
  appKey: 'calorie',
  taskKey: 'workspace',

  async buildPrompt(context) {
    const instruction = await readCalorieInstruction()
    const latestUserText = context.latestUserMessage?.text_content?.trim() ?? null
    const knowledgeContext = await renderKnowledgeContext(latestUserText)
    const today = new Date().toISOString().slice(0, 10)
    const hasAttachments = context.attachments.length > 0

    const fsInstruction = hasAttachments
      ? '如果存在图片附件，必须尝试读取附件绝对路径并结合图片内容判断食物和份量。'
      : '【禁止】本次无图片附件。禁止调用任何文件系统工具（ListDir、ReadFile、GlobSearch 等）。直接根据文字描述输出 JSON。'

    return {
      promptVersion: CALORIE_PROMPT_VERSION,
      knowledgeVersion: knowledgeContext.knowledgeVersion,
      metadata: {
        attachmentCount: context.attachments.length,
      },
      prompt: [
        '你是一个营养摄入计算器。根据用户描述的饮食内容，输出结构化 JSON 数据。',
        `今天日期：${today}`,
        '系统指令：',
        instruction,
        '对话上下文：',
        renderMessageContext(context),
        '附件：',
        renderAttachments(context),
        '知识库候选：',
        knowledgeContext.knowledgeText,
        '输出要求：',
        '- 只能输出一个 JSON 对象，不要输出 Markdown，不要输出代码块外说明。',
        '- 所有数值字段必须是 number 或 null。',
        '- 即使信息不完整，也要给出最合理的估算并把 estimate_level 设为 estimated。',
        fsInstruction,
        '- summary 用 1-3 句概括摄入与下一餐建议。',
        '- meals 至少包含 1 个餐次，每个餐次至少 1 个 item。',
        'JSON schema 示例：',
        buildResponseSchemaExample(),
      ].join('\n\n'),
    }
  },

  async parseOutput(stdout): Promise<AgentParsedResult<CalorieDraftPayload>> {
    const rawObject = extractJsonObjectFromText(stdout)
    const payload = validateCalorieDraftPayload(rawObject)

    return {
      status: 'needs_confirmation',
      assistantMessage: buildAssistantMessage(payload),
      draftPayload: payload,
      metadata: {
        schemaVersion: payload.schemaVersion,
      },
    }
  },
}