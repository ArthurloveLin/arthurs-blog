import 'server-only'

import { constants as fsConstants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'

export type AgentRuntimeSettingSource = 'env' | 'default'

export interface AgentRuntimeSetting<T> {
  value: T
  source: AgentRuntimeSettingSource
  envName: string
}

export interface AgentRuntimeConfig {
  agyBin: AgentRuntimeSetting<string>
  uploadRoot: AgentRuntimeSetting<string>
  homeRoot: AgentRuntimeSetting<string>
  timeoutMs: AgentRuntimeSetting<number>
  maxConcurrency: AgentRuntimeSetting<number>
  calorieDbJsonPath: AgentRuntimeSetting<string>
  oauthTokenPath: AgentRuntimeSetting<string>
}

export interface AgentRuntimeCheck {
  ok: boolean
  target: string
  detail: string
}

export interface AgentRuntimeHealth {
  ok: boolean
  config: AgentRuntimeConfig
  checks: {
    agyBin: AgentRuntimeCheck
    uploadRoot: AgentRuntimeCheck
    homeRoot: AgentRuntimeCheck
    calorieDbJsonPath: AgentRuntimeCheck
    oauthTokenPath: AgentRuntimeCheck
  }
  warnings: string[]
}

const DEFAULT_AGENT_RUNTIME = {
  agyBin: '/home/arthur/.local/bin/agy',
  uploadRoot: '/tmp/arthurs-blog/agent-uploads',
  homeRoot: '/tmp/arthurs-blog/agent-home',
  timeoutMs: 120_000,
  maxConcurrency: 1,
  calorieDbJsonPath: '/home/arthur/repositories/arthurs-blog/ClaudeDesign/calorie/calorie-db.json',
  oauthTokenPath: '/home/arthur/.gemini/antigravity-cli/antigravity-oauth-token',
} as const

function resolveStringSetting(envName: string, fallback: string): AgentRuntimeSetting<string> {
  const value = process.env[envName]?.trim()

  if (value) {
    return { value, source: 'env', envName }
  }

  return { value: fallback, source: 'default', envName }
}

function resolveNumberSetting(
  envName: string,
  fallback: number,
  warnings: string[]
): AgentRuntimeSetting<number> {
  const rawValue = process.env[envName]?.trim()

  if (!rawValue) {
    return { value: fallback, source: 'default', envName }
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    warnings.push(`${envName}=${rawValue} 无效，已回退到默认值 ${fallback}`)
    return { value: fallback, source: 'default', envName }
  }

  return { value: parsed, source: 'env', envName }
}

export function getAgentRuntimeConfig(): { config: AgentRuntimeConfig; warnings: string[] } {
  const warnings: string[] = []

  const config: AgentRuntimeConfig = {
    agyBin: resolveStringSetting('AGY_BIN', DEFAULT_AGENT_RUNTIME.agyBin),
    uploadRoot: resolveStringSetting('AGY_UPLOAD_ROOT', DEFAULT_AGENT_RUNTIME.uploadRoot),
    homeRoot: resolveStringSetting('AGY_HOME_ROOT', DEFAULT_AGENT_RUNTIME.homeRoot),
    timeoutMs: resolveNumberSetting('AGY_TIMEOUT_MS', DEFAULT_AGENT_RUNTIME.timeoutMs, warnings),
    maxConcurrency: resolveNumberSetting('AGY_MAX_CONCURRENCY', DEFAULT_AGENT_RUNTIME.maxConcurrency, warnings),
    calorieDbJsonPath: resolveStringSetting('CALORIE_DB_JSON_PATH', DEFAULT_AGENT_RUNTIME.calorieDbJsonPath),
    oauthTokenPath: resolveStringSetting('AGY_OAUTH_TOKEN_PATH', DEFAULT_AGENT_RUNTIME.oauthTokenPath),
  }

  return { config, warnings }
}

async function checkPath(target: string, mode: number, detail: string): Promise<AgentRuntimeCheck> {
  try {
    await access(target, mode)
    return { ok: true, target, detail }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return {
      ok: false,
      target,
      detail: `${detail} 检查失败: ${message}`,
    }
  }
}

export async function ensureAgentRuntimeDirectories(config: AgentRuntimeConfig) {
  await Promise.all([
    mkdir(config.uploadRoot.value, { recursive: true }),
    mkdir(config.homeRoot.value, { recursive: true }),
  ])
}

export async function getAgentRuntimeHealth(): Promise<AgentRuntimeHealth> {
  const { config, warnings } = getAgentRuntimeConfig()

  await ensureAgentRuntimeDirectories(config)

  const [agyBin, uploadRoot, homeRoot, calorieDbJsonPath, oauthTokenPath] = await Promise.all([
    checkPath(config.agyBin.value, fsConstants.X_OK, 'agy 可执行文件'),
    checkPath(config.uploadRoot.value, fsConstants.R_OK | fsConstants.W_OK, '上传目录读写权限'),
    checkPath(config.homeRoot.value, fsConstants.R_OK | fsConstants.W_OK, 'agy HOME 目录读写权限'),
    checkPath(config.calorieDbJsonPath.value, fsConstants.R_OK, '热量知识库 JSON 读权限'),
    checkPath(config.oauthTokenPath.value, fsConstants.R_OK, 'agy OAuth token 读权限'),
  ])

  return {
    ok: agyBin.ok && uploadRoot.ok && homeRoot.ok && calorieDbJsonPath.ok && oauthTokenPath.ok,
    config,
    checks: {
      agyBin,
      uploadRoot,
      homeRoot,
      calorieDbJsonPath,
      oauthTokenPath,
    },
    warnings,
  }
}

export async function assertAgentRuntimeReady() {
  const health = await getAgentRuntimeHealth()

  if (!health.ok) {
    const failedChecks = Object.values(health.checks)
      .filter((check) => !check.ok)
      .map((check) => `${check.target}: ${check.detail}`)
      .join('; ')

    throw new Error(`Agent runtime 未就绪: ${failedChecks}`)
  }

  return health.config
}