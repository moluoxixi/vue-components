import type { LowCodeComponentRegistry } from './registry'
import type {
  ConfigModelHistory,
  ConfigModelHistoryResult,
  LowCodePageModel,
  ModelOperation,
} from './types'
import { applyModelOperation } from './operations'
import { cloneConfigModel } from './transform'

export function createConfigModelHistory(
  model: LowCodePageModel,
  options: { limit?: number, revision?: number } = {},
): ConfigModelHistory {
  const limit = options.limit ?? 100
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Config model history limit must be a positive integer')
  return {
    present: cloneConfigModel(model),
    past: [],
    future: [],
    revision: options.revision ?? 0,
    limit,
  }
}

export function applyConfigModelOperation(
  history: ConfigModelHistory,
  operation: ModelOperation,
  registry: LowCodeComponentRegistry,
): ConfigModelHistoryResult {
  const result = applyModelOperation(history.present, operation, registry)
  if (!result.success)
    return { history, changed: false, diagnostics: result.diagnostics }
  const revision = history.revision + 1
  return {
    changed: true,
    diagnostics: result.diagnostics,
    history: {
      ...history,
      present: result.model,
      revision,
      past: [...history.past, { operation, inverse: result.inverse, revision }].slice(-history.limit),
      future: [],
    },
  }
}

export function undoConfigModelHistory(
  history: ConfigModelHistory,
  registry: LowCodeComponentRegistry,
): ConfigModelHistoryResult {
  const entry = history.past.at(-1)
  if (!entry)
    return { history, changed: false, diagnostics: [] }
  const result = applyModelOperation(history.present, entry.inverse, registry)
  if (!result.success)
    return { history, changed: false, diagnostics: result.diagnostics }
  return {
    changed: true,
    diagnostics: [],
    history: {
      ...history,
      present: result.model,
      revision: history.revision + 1,
      past: history.past.slice(0, -1),
      future: [entry, ...history.future],
    },
  }
}

export function redoConfigModelHistory(
  history: ConfigModelHistory,
  registry: LowCodeComponentRegistry,
): ConfigModelHistoryResult {
  const [entry, ...future] = history.future
  if (!entry)
    return { history, changed: false, diagnostics: [] }
  const result = applyModelOperation(history.present, entry.operation, registry)
  if (!result.success)
    return { history, changed: false, diagnostics: result.diagnostics }
  return {
    changed: true,
    diagnostics: [],
    history: {
      ...history,
      present: result.model,
      revision: history.revision + 1,
      past: [...history.past, entry].slice(-history.limit),
      future,
    },
  }
}
