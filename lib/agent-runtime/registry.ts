import 'server-only'

import type { AgentRuntimeAdapter } from '@/lib/agent-runtime/contracts'
import { AppError } from '@/lib/app-error'
import { calorieWorkspaceAgentAdapter } from '@/lib/calorie/agent'

const adapterRegistry = new Map<string, AgentRuntimeAdapter>([
  [`${calorieWorkspaceAgentAdapter.appKey}:${calorieWorkspaceAgentAdapter.taskKey}`, calorieWorkspaceAgentAdapter],
])

export function getAgentRuntimeAdapter(appKey: string, taskKey: string) {
  const adapter = adapterRegistry.get(`${appKey}:${taskKey}`)
  if (!adapter) {
    throw new AppError(400, `Unsupported agent adapter: ${appKey}/${taskKey}`)
  }

  return adapter
}

export function listAgentRuntimeAdapters() {
  return Array.from(adapterRegistry.values())
}