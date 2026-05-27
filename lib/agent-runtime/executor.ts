import 'server-only'

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { getAgentRuntimeConfig } from '@/lib/agent-runtime/config'
import { AppError } from '@/lib/app-error'

export interface AgyExecutionInput {
  prompt: string
  addDirs?: string[]
  cwd?: string
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

function resolveHomeDirectory(homeRoot: string, homeSubpath?: string) {
  const currentHome = process.env.HOME?.trim()
  if (currentHome) {
    return currentHome
  }

  const normalizedSubpath = (homeSubpath ?? 'shared').replace(/[^a-zA-Z0-9/_-]+/g, '-')
  return resolve(homeRoot, normalizedSubpath)
}

export async function executeAgyPrompt(input: AgyExecutionInput): Promise<AgyExecutionResult> {
  const { config } = getAgentRuntimeConfig()

  return withExecutionSlot(config.maxConcurrency.value, async () => {
    const homeDirectory = resolveHomeDirectory(config.homeRoot.value, input.homeSubpath)
    await mkdir(homeDirectory, { recursive: true })

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
        cwd: input.cwd ?? process.cwd(),
        env: {
          ...process.env,
          HOME: homeDirectory,
        },
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