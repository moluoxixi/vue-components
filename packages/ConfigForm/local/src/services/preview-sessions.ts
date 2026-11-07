import type { ProjectDocument, ProjectOperation, ProjectRepository } from '@moluoxixi/config-form-model'
import type { StudioPresetId } from '@moluoxixi/config-form-studio'
import type { LivePreviewSession, WorkspaceChange } from '@moluoxixi/config-form-studio/client'
import type { ModelMessage } from 'ai'
import { randomUUID } from 'node:crypto'
import { applyProjectTransaction, createComponentContractRegistry } from '@moluoxixi/config-form-model'
import { createStudioProject, getStudioCatalog, getStudioPreset } from '@moluoxixi/config-form-studio'

export class PreviewSessionError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) { super(message) }
}

interface Session {
  state: LivePreviewSession
  history: ProjectDocument[]
  receipts: Map<string, { signature: string, revision: number }>
  saved?: ProjectDocument
  sdkMessages: ModelMessage[]
  abort?: AbortController
  saving: boolean
}

export function createPreviewSessions(repository: ProjectRepository, publish: (change: WorkspaceChange) => void) {
  const sessions = new Map<string, Session>()
  const changed = (entry: Session) => {
    publish({ kind: 'preview', sessionId: entry.state.id })
  }
  function get(id: unknown): Session {
    const entry = typeof id === 'string' ? sessions.get(id) : undefined
    if (!entry)
      throw new PreviewSessionError('PREVIEW_NOT_FOUND', '预览会话已结束。请创建新会话；已保存的项目不受影响。', 404)
    return entry
  }
  function check(entry: Session, revision: unknown, allowBusy = false): void {
    if (entry.saving || (entry.state.busy && !allowBusy))
      throw new PreviewSessionError('PREVIEW_BUSY', '当前会话正在生成或保存，请完成后再操作。', 409)
    if (revision !== entry.state.revision)
      throw new PreviewSessionError('PREVIEW_CONFLICT', `预览已更新到版本 ${entry.state.revision}，请读取当前会话后重试。`, 409)
  }
  async function create(input: { projectId?: string, expectedRepositoryRevision?: number, preset?: StudioPresetId, name?: string, surfaceId?: string }): Promise<LivePreviewSession> {
    if ((input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100))
      || (input.projectId !== undefined && (typeof input.projectId !== 'string' || !input.projectId))
      || (input.surfaceId !== undefined && typeof input.surfaceId !== 'string')) {
      throw new PreviewSessionError('PREVIEW_INPUT_INVALID', '请提供有效的项目、页面和 1–100 字的名称。')
    }
    if (sessions.size >= 32)
      throw new PreviewSessionError('PREVIEW_LIMIT', '最多同时打开 32 个预览会话，请先结束不用的会话。')
    const project = input.projectId ? await repository.get(input.projectId) : undefined
    if (input.projectId && !project)
      throw new PreviewSessionError('PREVIEW_PROJECT_MISSING', '项目不存在。', 404)
    if (project && input.expectedRepositoryRevision !== project.repositoryRevision)
      throw new PreviewSessionError('PREVIEW_CONFLICT', '项目版本已更新，请重新读取项目后创建预览。', 409)
    const preset = input.preset ?? project?.document.registryLock.adapter ?? 'element-plus'
    if (preset !== 'element-plus' && preset !== 'antd-vue')
      throw new PreviewSessionError('PREVIEW_PRESET_INVALID', '请选择 Element Plus 或 Ant Design Vue。')
    const document = structuredClone(project?.document ?? createStudioProject({ id: `ai-${randomUUID()}`, name: input.name?.trim() || 'AI 表单', preset }))
    const surfaceId = input.surfaceId ?? document.homeSurfaceId
    if (!document.surfacesById[surfaceId])
      throw new PreviewSessionError('PREVIEW_SURFACE_MISSING', '预览页面不存在。')
    const state: LivePreviewSession = { id: randomUUID(), document, surfaceId, revision: 0, ...(project ? { savedRevision: project.repositoryRevision } : {}), dirty: !project, busy: false, canUndo: false, messages: [] }
    const entry: Session = { state, history: [], receipts: new Map(), ...(project ? { saved: structuredClone(document) } : {}), sdkMessages: [], saving: false }
    sessions.set(state.id, entry)
    return structuredClone(state)
  }
  function apply(input: { sessionId: string, expectedSessionRevision: number, commandId: string, label: string, operations: ProjectOperation[] }, allowBusy = false): LivePreviewSession {
    const entry = get(input.sessionId)
    const signature = JSON.stringify(input)
    const receipt = entry.receipts.get(input.commandId)
    if (receipt) {
      if (receipt.signature !== signature)
        throw new PreviewSessionError('PREVIEW_COMMAND_REUSED', 'commandId 已用于另一项修改。', 409)
      return structuredClone(entry.state)
    }
    check(entry, input.expectedSessionRevision, allowBusy)
    if (typeof input.commandId !== 'string' || !input.commandId || input.commandId.length > 200 || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 80 || !Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 100)
      throw new PreviewSessionError('PREVIEW_OPERATIONS_INVALID', '每次提交 1–100 项修改，并提供 commandId 和简短说明。')
    if (entry.receipts.size >= 1000)
      throw new PreviewSessionError('PREVIEW_LIMIT', '本会话已达到修改上限，请保存后创建新会话。')
    const preset = entry.state.document.registryLock.adapter as StudioPresetId
    const registry = createComponentContractRegistry(getStudioCatalog(preset).materials.map(material => material.contract), { adapter: getStudioPreset(preset).registry.adapter, version: getStudioPreset(preset).registry.adapterVersion })
    const result = applyProjectTransaction(entry.state.document, { id: input.commandId, label: input.label, operations: input.operations }, { registry })
    if (!result.success)
      throw new PreviewSessionError('PREVIEW_INVALID', JSON.stringify(result.diagnostics))
    entry.history.push(entry.state.document)
    if (entry.history.length > 50)
      entry.history.shift()
    entry.state.document = result.document
    if (!result.document.surfacesById[entry.state.surfaceId])
      entry.state.surfaceId = result.document.homeSurfaceId
    entry.state.revision++
    entry.state.dirty = !entry.saved || JSON.stringify(entry.saved) !== JSON.stringify(result.document)
    entry.state.canUndo = true
    entry.state.messages.push({ id: randomUUID(), role: 'update', text: input.label })
    entry.receipts.set(input.commandId, { signature, revision: entry.state.revision })
    changed(entry)
    return structuredClone(entry.state)
  }
  function undo(id: string, revision: number): LivePreviewSession {
    const entry = get(id)
    check(entry, revision)
    const previous = entry.history.pop()
    if (!previous)
      throw new PreviewSessionError('PREVIEW_UNDO_EMPTY', '还没有可以撤销的修改。')
    entry.state.document = previous
    if (!previous.surfacesById[entry.state.surfaceId])
      entry.state.surfaceId = previous.homeSurfaceId
    entry.state.revision++
    entry.state.canUndo = entry.history.length > 0
    entry.state.dirty = !entry.saved || JSON.stringify(entry.saved) !== JSON.stringify(previous)
    entry.state.messages.push({ id: randomUUID(), role: 'update', text: '已撤销上一批修改' })
    // Subsequent chat receives the current document, not stale tool state.
    entry.sdkMessages = []
    changed(entry)
    return structuredClone(entry.state)
  }
  async function save(id: string, revision: number): Promise<LivePreviewSession> {
    const entry = get(id)
    check(entry, revision)
    if (!entry.state.dirty)
      return structuredClone(entry.state)
    entry.saving = true
    try {
      const result = entry.state.savedRevision === undefined
        ? await repository.create({ document: entry.state.document, embeddedContents: [] })
        : (await repository.commit({ id: entry.state.document.id, document: entry.state.document, expectedRepositoryRevision: entry.state.savedRevision, commandId: `preview:${id}:${revision}`, metadata: { source: 'manual', label: '保存 AI 预览' } })).project
      entry.state.savedRevision = result.repositoryRevision
      entry.saved = structuredClone(result.document)
      entry.state.dirty = false
      publish({ kind: 'project', projectId: result.document.id, repositoryRevision: result.repositoryRevision })
      changed(entry)
      return structuredClone(entry.state)
    }
    finally { entry.saving = false }
  }
  return {
    create,
    get,
    apply,
    undo,
    save,
    changed,
    read: (id: string) => structuredClone(get(id).state),
    close(id: string) {
      const entry = get(id)
      if (entry.saving)
        throw new PreviewSessionError('PREVIEW_BUSY', '正在保存，请完成后结束会话。', 409)
      entry.abort?.abort()
      sessions.delete(id)
      publish({ kind: 'preview', sessionId: id })
    },
    dispose() {
      for (const entry of sessions.values()) entry.abort?.abort()
      sessions.clear()
    },
  }
}
