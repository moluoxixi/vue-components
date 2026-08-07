import type { DesignerDocument } from '../document'
import type { DesignerRegistry } from '../registry'
import type {
  DesignerCommand,
  DesignerHistoryResult,
  DesignerHistoryState,
} from './types'
import { DESIGNER_HISTORY_LIMIT } from '../constants'
import { cloneDesignerDocument } from '../document'
import { reduceDesignerCommand } from './reducer'

export function createDesignerHistory(
  document: DesignerDocument,
  limit = DESIGNER_HISTORY_LIMIT,
): DesignerHistoryState {
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Designer history limit must be a positive integer')
  return {
    past: [],
    present: cloneDesignerDocument(document),
    future: [],
    limit,
  }
}

export function applyDesignerCommand(
  history: DesignerHistoryState,
  command: DesignerCommand,
  registry: DesignerRegistry,
): DesignerHistoryResult {
  const result = reduceDesignerCommand(history.present, command, registry)
  if (!result.changed)
    return { history, changed: false, diagnostics: result.diagnostics }

  return {
    history: {
      past: [...history.past, cloneDesignerDocument(history.present)].slice(-history.limit),
      present: cloneDesignerDocument(result.document),
      future: [],
      limit: history.limit,
    },
    changed: true,
    diagnostics: result.diagnostics,
  }
}

export function undoDesignerHistory(history: DesignerHistoryState): DesignerHistoryResult {
  const previous = history.past.at(-1)
  if (!previous)
    return { history, changed: false, diagnostics: [] }

  return {
    history: {
      past: history.past.slice(0, -1),
      present: cloneDesignerDocument(previous),
      future: [cloneDesignerDocument(history.present), ...history.future],
      limit: history.limit,
    },
    changed: true,
    diagnostics: [],
  }
}

export function redoDesignerHistory(history: DesignerHistoryState): DesignerHistoryResult {
  const [next, ...future] = history.future
  if (!next)
    return { history, changed: false, diagnostics: [] }

  return {
    history: {
      past: [...history.past, cloneDesignerDocument(history.present)].slice(-history.limit),
      present: cloneDesignerDocument(next),
      future,
      limit: history.limit,
    },
    changed: true,
    diagnostics: [],
  }
}

export function resetDesignerHistory(
  history: DesignerHistoryState,
  document: DesignerDocument,
): DesignerHistoryState {
  return createDesignerHistory(document, history.limit)
}
