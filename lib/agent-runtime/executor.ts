import 'server-only'

import { spawn } from 'node:child_process'
import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { getAgentRuntimeConfig } from '@/lib/agent-runtime/config'
import { AppError } from '@/lib/app-error'

export interface AgyExecutionInput {
  prompt: string
  addDirs?: string[]
  homeSubpath?: string
}

export interface AgyExecutionResult {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  durationMs: number
  command: string[]
}

let activeExecutionCount = 0
const waitingResolvers: Array<() => void> = []

async function withExecutionSlot<T>(maxConcurrency: number, operation: () => Promise<T>): Promise<T> {
  if (activeExecutionCount >= maxConcurrency) {
    await new Promise<void>((resolveQueue) => {
      waitingResolvers.push(resolveQueue)
    })
  }

  activeExecutionCount += 1

  try {
    return await operation()
  } finally {
    activeExecutionCount = Math.max(0, activeExecutionCount - 1)
    const next = waitingResolvers.shift()
    if (next) {
      next()
    }
  }
}

// Always use an isolated per-thread directory. Never reads process.env.HOME.
function buildIsolatedHomeDir(homeRoot: string, homeSubpath?: string): string {
  const normalized = (homeSubpath ?? 'shared').replace(/[^a-zA-Z0-9/_-]+/g, '-')
  return resolve(homeRoot, normalized)
}

// Prepare isolated HOME: create the directory, symlink the OAuth token, and write
// a minimal settings.json so agy uses the right model and doesn't fallback to defaults.
async function prepareIsolatedHome(homeDir: string, oauthTokenPath: string): Promise<void> {
  const tokenDir = join(homeDir, '.gemini', 'antigravity-cli')
  await mkdir(tokenDir, { recursive: true })

  const tokenLink = join(tokenDir, 'antigravity-oauth-token')
  try {
    await symlink(oauthTokenPath, tokenLink)
  } catch (error) {
    // EEXIST is fine — symlink already placed on a previous run
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }

  // Write settings.json only on first run (EEXIST = already done).
  // Keeps the model at High quality; no trusted workspaces (sandbox isolation).
  const settingsPath = join(tokenDir, 'settings.json')
  const settings = JSON.stringify({ model: 'Gemini 3.5 Flash (High)' })
  try {
    await writeFile(settingsPath, settings, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

// Minimal environment passed to agy.
// Intentionally excludes all process.env secrets (Supabase keys, R2 creds, etc.).
function buildSandboxEnv(homeDirectory: string): NodeJS.ProcessEnv {
  // Cast required: Next.js augments ProcessEnv with required app-specific keys,
  // but we intentionally exclude all app secrets from the agy subprocess.
  return {
    HOME: homeDirectory,
    PATH: process.env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    TMPDIR: '/tmp',
  } as unknown as NodeJS.ProcessEnv
}

export async function executeAgyPrompt(input: AgyExecutionInput): Promise<AgyExecutionResult> {
  const { config } = getAgentRuntimeConfig()

  return withExecutionSlot(config.maxConcurrency.value, async () => {
    const homeDirectory = buildIsolatedHomeDir(config.homeRoot.value, input.homeSubpath)
    await prepareIsolatedHome(homeDirectory, config.oauthTokenPath.value)

    const args = ['--dangerously-skip-permissions']
    const addDirs = Array.from(new Set((input.addDirs ?? []).map((dir) => resolve(dir))))

    for (const dir of addDirs) {
      args.push('--add-dir', dir)
    }

    args.push('-p', input.prompt)

    const command = [config.agyBin.value, ...args]
    const startedAt = Date.now()

    return new Promise<AgyExecutionResult>((resolvePromise, rejectPromise) => {
      const child = spawn(config.agyBin.value, args, {
        cwd: homeDirectory,
        env: buildSandboxEnv(homeDirectory),
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const timeoutHandle = setTimeout(() => {
        if (settled) {
          return
        }

        settled = true
        child.kill('SIGKILL')
        rejectPromise(
          new AppError(504, `agy execution timed out after ${config.timeoutMs.value}ms`, {
            cause: {
              stdout,
              stderr,
              exitCode: null,
              signal: 'SIGKILL',
              durationMs: Date.now() - startedAt,
              command,
            },
          })
        )
      }, config.timeoutMs.value)

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      child.on('error', (error) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeoutHandle)
        rejectPromise(
          new AppError(500, error.message, {
            cause: {
              stdout,
              stderr,
              exitCode: null,
              signal: null,
              durationMs: Date.now() - startedAt,
              command,
            },
          })
        )
      })

      child.on('close', (exitCode, signal) => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeoutHandle)

        const result: AgyExecutionResult = {
          stdout,
          stderr,
          exitCode,
          signal,
          durationMs: Date.now() - startedAt,
          command,
        }

        if (exitCode !== 0) {
          rejectPromise(new AppError(502, `agy exited with code ${String(exitCode)}`, { cause: result }))
          return
        }

        resolvePromise(result)
      })
    })
  })
}
