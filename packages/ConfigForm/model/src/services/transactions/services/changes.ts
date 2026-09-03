import type { Draft } from 'immer'
import type { NodeId, PageId, ProjectDocument, ProjectNodeChange, ProjectNodeRelation, ProjectOperation } from '../../../types'
import type { OperationResult } from '../types'
import { stableConfigFormJsonStringify } from '@moluoxixi/config-form-core'
import { current, isDraft } from 'immer'

export function hasSemanticChanges(
  previous: ProjectDocument,
  candidate: ProjectDocument,
  changedProject: boolean,
  changedPageIds: ReadonlySet<PageId>,
): boolean {
  if (changedProject) {
    const previousProjectState = {
      homePageId: previous.homePageId,
      pageOrder: previous.pageOrder,
      settings: previous.settings,
    }
    const candidateProjectState = {
      homePageId: candidate.homePageId,
      pageOrder: candidate.pageOrder,
      settings: candidate.settings,
    }
    if (!semanticallyEqual(previousProjectState, candidateProjectState))
      return true
  }

  for (const pageId of changedPageIds) {
    if (!semanticallyEqual(previous.pagesById[pageId], candidate.pagesById[pageId]))
      return true
  }
  return false
}

export function semanticallyEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  return stableConfigFormJsonStringify(left) === stableConfigFormJsonStringify(right)
}

export function cloneModelValue<T>(value: T): T {
  const snapshot = isDraft(value) ? current(value as Draft<T>) : value
  return structuredClone(snapshot)
}

export function changed(
  inverse: ProjectOperation[],
  changedPageIds: PageId[],
  changedNodeIds: NodeId[] = [],
  changedProject = false,
  changedNodeChanges: ProjectNodeChange[] = defaultNodeChanges(changedPageIds, changedNodeIds),
): OperationResult {
  return { changedProject, inverse, changedPageIds, changedNodeIds, changedNodeChanges }
}

export function unchanged(): OperationResult {
  return changed([], [])
}

function defaultNodeChanges(pageIds: PageId[], nodeIds: NodeId[]): ProjectNodeChange[] {
  const pageId = pageIds.length === 1 ? pageIds[0] : undefined
  return pageId
    ? nodeIds.map(nodeId => ({ kind: 'content', pageId, nodeId }))
    : []
}

export function normalizeNodeChanges(changes: ProjectNodeChange[]): ProjectNodeChange[] {
  const normalized = new Map<string, ProjectNodeChange>()
  for (const change of changes) {
    const key = `${change.pageId}\u0000${change.nodeId}`
    const previous = normalized.get(key)
    if (!previous) {
      normalized.set(key, change)
      continue
    }
    const before = previous.before ?? change.before
    const after = change.after ?? previous.after
    const kind = previous.kind === 'insert' && change.kind === 'remove'
      ? 'content'
      : previous.kind === 'remove' && change.kind === 'insert'
        ? 'move'
        : change.kind === 'content'
          ? previous.kind
          : change.kind
    normalized.set(key, {
      kind,
      pageId: change.pageId,
      nodeId: change.nodeId,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
    })
  }
  return [...normalized.values()]
}

export function nodeRelation(parentId: NodeId | null, slot?: string): ProjectNodeRelation {
  return { parentId, slot: parentId === null ? null : (slot ?? 'default') }
}
