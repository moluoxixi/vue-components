import type { LowCodeNode, LowCodePageModel } from '@moluoxixi/config-form-designer'
import type {
  ProjectPath,
  WorkspaceFile,
  WorkspaceProject,
  WorkspaceProjectDraft,
  WorkspaceProjectManifest,
} from './types'
import {
  designerDocumentToConfigModel,
  parseDesignerDocument,
} from '@moluoxixi/config-form-designer'
import { z } from 'zod'
import { WorkspaceProjectError } from './errors'
import { assertUniqueProjectPaths, normalizeProjectPath, safeProjectSlug } from './path'

export const WORKSPACE_APPLICATION_SCHEMA_VERSION = 2 as const
export const WORKSPACE_APPLICATION_STORAGE_VERSION = 1 as const

export interface WorkspacePage {
  id: string
  model: LowCodePageModel
  name: string
  route: string
}

export interface WorkspaceApplication {
  createdAt: string
  files: Record<ProjectPath, WorkspaceFile>
  homePageId: string
  id: string
  manifest: WorkspaceProjectManifest
  name: string
  pages: WorkspacePage[]
  revision: number
  schemaVersion: typeof WORKSPACE_APPLICATION_SCHEMA_VERSION
  template: {
    id: string
    version: number
  }
  updatedAt: string
}

export interface WorkspaceApplicationSummary {
  adapter: WorkspaceProjectManifest['adapter']
  homePageId: string
  id: string
  name: string
  pageCount: number
  revision: number
  templateId: string
  updatedAt: string
}

export interface WorkspaceApplicationDraft {
  activePageId: string
  application: WorkspaceApplication
  baseRevision: number
  updatedAt: string
}

export interface StoredWorkspaceApplication {
  application: WorkspaceApplication
  draft?: WorkspaceApplicationDraft
  storageSchemaVersion: typeof WORKSPACE_APPLICATION_STORAGE_VERSION
}

export type WorkspaceApplicationOperation
  = | { type: 'add-page', page: WorkspacePage, index?: number }
    | { type: 'duplicate-page', pageId: string, page: WorkspacePage, index?: number }
    | { type: 'move-page', pageId: string, index: number }
    | { type: 'remove-page', pageId: string }
    | { type: 'rename-page', pageId: string, name: string }
    | { type: 'set-home-page', pageId: string }
    | { type: 'set-page-route', pageId: string, route: string }
    | { type: 'update-page-model', pageId: string, model: LowCodePageModel }

const identifierSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9-]*$/)
const timestampSchema = z.string().datetime({ offset: true })
const textFileSchema = z.object({
  content: z.string(),
  kind: z.literal('text'),
  language: z.string().min(1).optional(),
}).strict()
const binaryFileSchema = z.object({
  content: z.instanceof(Uint8Array),
  kind: z.literal('binary'),
}).strict()
const workspaceFileSchema = z.discriminatedUnion('kind', [textFileSchema, binaryFileSchema])
const manifestSchema = z.object({
  adapter: z.enum(['antd-vue', 'element-plus']),
  dependencies: z.record(z.string().min(1)),
  designerArtifact: z.string().min(1),
  entry: z.string().min(1),
  framework: z.literal('vue'),
  generatedFormModule: z.string().min(1),
}).strict()

function invalidApplication(message: string, cause?: unknown): never {
  throw new WorkspaceProjectError(
    'PROJECT_INVALID',
    `[config-form-workbench] ${message}`,
    cause instanceof Error ? { cause } : undefined,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (Array.isArray(value)) {
    if (seen.has(value))
      return false
    seen.add(value)
    return value.every(item => isJsonValue(item, seen))
  }
  if (!isRecord(value) || seen.has(value))
    return false
  seen.add(value)
  return Object.values(value).every(item => isJsonValue(item, seen))
}

function isLowCodeNode(value: unknown): value is LowCodeNode {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.component !== 'string'
    || !['field', 'container'].includes(String(value.kind))
    || !isRecord(value.props)
    || !isRecord(value.events)
    || !isRecord(value.bindings)
    || !Array.isArray(value.children)
    || !isRecord(value.slots)) {
    return false
  }
  return value.children.every(isLowCodeNode)
    && Object.values(value.slots).every(nodes => Array.isArray(nodes) && nodes.every(isLowCodeNode))
}

export function isLowCodePageModel(value: unknown): value is LowCodePageModel {
  return isRecord(value)
    && value.version === 1
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && isRecord(value.props)
    && isRecord(value.form)
    && Array.isArray(value.nodes)
    && value.nodes.every(isLowCodeNode)
    && (value.flows === undefined || Array.isArray(value.flows))
    && isJsonValue(value)
}

const pageSchema = z.object({
  id: identifierSchema,
  model: z.custom<LowCodePageModel>(isLowCodePageModel, 'page model is invalid'),
  name: z.string().trim().min(1).max(120),
  route: z.string().min(1),
}).strict()

const applicationSchema = z.object({
  createdAt: timestampSchema,
  files: z.record(workspaceFileSchema),
  homePageId: identifierSchema,
  id: identifierSchema,
  manifest: manifestSchema,
  name: z.string().trim().min(1).max(120),
  pages: z.array(pageSchema).min(1),
  revision: z.number().int().positive(),
  schemaVersion: z.literal(WORKSPACE_APPLICATION_SCHEMA_VERSION),
  template: z.object({
    id: identifierSchema,
    version: z.number().int().positive(),
  }).strict(),
  updatedAt: timestampSchema,
}).strict()

const draftSchema = z.object({
  activePageId: identifierSchema,
  application: z.unknown(),
  baseRevision: z.number().int().positive(),
  updatedAt: timestampSchema,
}).strict()

export function normalizeWorkspacePageRoute(input: string): string {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/') || trimmed.includes('\\') || trimmed.includes('?') || trimmed.includes('#'))
    invalidApplication(`invalid page route "${input}"`)
  const segments = trimmed.split('/').filter(Boolean)
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !/^[a-z0-9][a-z0-9-]*$/i.test(segment))
      invalidApplication(`invalid page route "${input}"`)
  }
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

function normalizeApplicationFiles(
  files: Record<string, WorkspaceFile>,
  manifest: WorkspaceProjectManifest,
): { files: Record<ProjectPath, WorkspaceFile>, manifest: WorkspaceProjectManifest } {
  const sourceKeys = Object.keys(files)
  const paths = assertUniqueProjectPaths(sourceKeys)
  const normalizedFiles = Object.fromEntries(paths.map((path, index) => [path, files[sourceKeys[index]!]!])) as Record<ProjectPath, WorkspaceFile>
  const entry = normalizeProjectPath(manifest.entry)
  const designerArtifact = normalizeProjectPath(manifest.designerArtifact)
  const generatedFormModule = normalizeProjectPath(manifest.generatedFormModule)
  for (const required of [entry, designerArtifact, generatedFormModule]) {
    if (!Object.hasOwn(normalizedFiles, required))
      invalidApplication(`manifest references missing file "${required}"`)
  }
  return {
    files: normalizedFiles,
    manifest: { ...manifest, designerArtifact, entry, generatedFormModule },
  }
}

export function parseWorkspaceApplication(input: unknown): WorkspaceApplication {
  const result = applicationSchema.safeParse(input)
  if (!result.success)
    invalidApplication('workspace application is invalid', result.error)

  const pageIds = new Set<string>()
  const pageRoutes = new Set<string>()
  const pages = result.data.pages.map((page) => {
    if (pageIds.has(page.id))
      invalidApplication(`duplicate page id "${page.id}"`)
    pageIds.add(page.id)
    const route = normalizeWorkspacePageRoute(page.route)
    if (pageRoutes.has(route))
      invalidApplication(`duplicate page route "${route}"`)
    pageRoutes.add(route)
    return {
      ...structuredClone(page),
      model: { ...structuredClone(page.model), id: page.id, name: page.name },
      route,
    }
  })
  if (!pageIds.has(result.data.homePageId))
    invalidApplication(`home page "${result.data.homePageId}" does not exist`)

  const normalized = normalizeApplicationFiles(result.data.files, result.data.manifest as WorkspaceProjectManifest)
  return {
    ...structuredClone(result.data),
    files: normalized.files,
    manifest: normalized.manifest,
    pages,
  } as WorkspaceApplication
}

export function parseWorkspaceApplicationDraft(input: unknown): WorkspaceApplicationDraft {
  const result = draftSchema.safeParse(input)
  if (!result.success)
    invalidApplication('workspace application draft is invalid', result.error)
  const application = parseWorkspaceApplication(result.data.application)
  if (application.id === '' || !application.pages.some(page => page.id === result.data.activePageId))
    invalidApplication('workspace application draft active page does not exist')
  return { ...result.data, application }
}

export function cloneWorkspaceApplication(application: WorkspaceApplication): WorkspaceApplication {
  return structuredClone(application)
}

export function summarizeWorkspaceApplication(application: WorkspaceApplication): WorkspaceApplicationSummary {
  return {
    adapter: application.manifest.adapter,
    homePageId: application.homePageId,
    id: application.id,
    name: application.name,
    pageCount: application.pages.length,
    revision: application.revision,
    templateId: application.template.id,
    updatedAt: application.updatedAt,
  }
}

export function commitWorkspaceApplication(
  current: WorkspaceApplication,
  baseRevision: number,
  next: WorkspaceApplication,
  updatedAt: string,
): WorkspaceApplication {
  if (current.revision !== baseRevision) {
    throw new WorkspaceProjectError(
      'PROJECT_REVISION_CONFLICT',
      `[config-form-workbench] application "${current.id}" changed from revision ${baseRevision} to ${current.revision}`,
    )
  }
  if (next.id !== current.id)
    invalidApplication('a commit cannot change the application id')
  return parseWorkspaceApplication({
    ...cloneWorkspaceApplication(next),
    createdAt: current.createdAt,
    revision: current.revision + 1,
    updatedAt,
  })
}

function readLegacyPageModel(project: WorkspaceProject): LowCodePageModel {
  const file = project.files[project.manifest.designerArtifact]
  if (file?.kind !== 'text')
    invalidApplication('legacy project designer artifact is not a text file')
  let input: unknown
  try {
    input = JSON.parse(file.content) as unknown
  }
  catch (error) {
    invalidApplication('legacy project designer artifact is not valid JSON', error)
  }
  if (isLowCodePageModel(input))
    return structuredClone(input)
  const parsed = parseDesignerDocument(input)
  if (!parsed.success)
    invalidApplication(parsed.diagnostics[0]?.message ?? 'legacy designer document is invalid')
  return designerDocumentToConfigModel(parsed.data, { id: 'home', name: project.name })
}

export function migrateWorkspaceProjectToApplication(project: WorkspaceProject): WorkspaceApplication {
  const pageId = 'home'
  const model = readLegacyPageModel(project)
  return parseWorkspaceApplication({
    createdAt: project.createdAt,
    files: structuredClone(project.files),
    homePageId: pageId,
    id: project.id,
    manifest: structuredClone(project.manifest),
    name: project.name,
    pages: [{
      id: pageId,
      model: { ...model, id: pageId, name: project.name },
      name: project.name,
      route: '/',
    }],
    revision: project.revision,
    schemaVersion: WORKSPACE_APPLICATION_SCHEMA_VERSION,
    template: structuredClone(project.template),
    updatedAt: project.updatedAt,
  })
}

export function migrateWorkspaceProjectDraft(
  project: WorkspaceProject,
  draft: WorkspaceProjectDraft,
): WorkspaceApplicationDraft {
  const next = structuredClone(project)
  for (const [path, content] of Object.entries(draft.files)) {
    const normalized = normalizeProjectPath(path)
    const file = next.files[normalized]
    if (file?.kind === 'text' && content !== undefined)
      file.content = content
  }
  const application = migrateWorkspaceProjectToApplication(next)
  return parseWorkspaceApplicationDraft({
    activePageId: application.homePageId,
    application,
    baseRevision: draft.baseRevision,
    updatedAt: draft.updatedAt,
  })
}

function pageIndex(application: WorkspaceApplication, pageId: string): number {
  const index = application.pages.findIndex(page => page.id === pageId)
  if (index < 0)
    invalidApplication(`page "${pageId}" does not exist`)
  return index
}

export function applyWorkspaceApplicationOperation(
  application: WorkspaceApplication,
  operation: WorkspaceApplicationOperation,
): WorkspaceApplication {
  const next = cloneWorkspaceApplication(application)
  switch (operation.type) {
    case 'add-page': {
      if (next.pages.some(page => page.id === operation.page.id))
        invalidApplication(`page "${operation.page.id}" already exists`)
      const index = Math.max(0, Math.min(operation.index ?? next.pages.length, next.pages.length))
      next.pages.splice(index, 0, structuredClone(operation.page))
      break
    }
    case 'duplicate-page': {
      const sourceIndex = pageIndex(next, operation.pageId)
      if (next.pages.some(page => page.id === operation.page.id))
        invalidApplication(`page "${operation.page.id}" already exists`)
      const index = Math.max(0, Math.min(operation.index ?? sourceIndex + 1, next.pages.length))
      next.pages.splice(index, 0, structuredClone(operation.page))
      break
    }
    case 'move-page': {
      const sourceIndex = pageIndex(next, operation.pageId)
      const [page] = next.pages.splice(sourceIndex, 1)
      const index = Math.max(0, Math.min(operation.index, next.pages.length))
      next.pages.splice(index, 0, page!)
      break
    }
    case 'remove-page': {
      if (next.pages.length === 1)
        invalidApplication('the last page cannot be deleted')
      const index = pageIndex(next, operation.pageId)
      next.pages.splice(index, 1)
      if (next.homePageId === operation.pageId)
        next.homePageId = next.pages[Math.min(index, next.pages.length - 1)]!.id
      break
    }
    case 'rename-page': {
      const page = next.pages[pageIndex(next, operation.pageId)]!
      page.name = operation.name.trim()
      page.model.name = page.name
      break
    }
    case 'set-home-page':
      pageIndex(next, operation.pageId)
      next.homePageId = operation.pageId
      break
    case 'set-page-route':
      next.pages[pageIndex(next, operation.pageId)]!.route = normalizeWorkspacePageRoute(operation.route)
      break
    case 'update-page-model': {
      const page = next.pages[pageIndex(next, operation.pageId)]!
      page.model = { ...structuredClone(operation.model), id: page.id, name: page.name }
      break
    }
  }
  return parseWorkspaceApplication(next)
}

function collectNodeIds(nodes: LowCodeNode[], target: string[] = []): string[] {
  for (const node of nodes) {
    target.push(node.id)
    collectNodeIds(node.children, target)
    Object.values(node.slots).forEach(children => collectNodeIds(children, target))
  }
  return target
}

function duplicatePageNode(node: LowCodeNode, idMap: Readonly<Record<string, string>>): LowCodeNode {
  return {
    ...structuredClone(node),
    id: idMap[node.id]!,
    children: node.children.map(child => duplicatePageNode(child, idMap)),
    slots: Object.fromEntries(Object.entries(node.slots).map(([name, children]) => [
      name,
      children.map(child => duplicatePageNode(child, idMap)),
    ])),
  }
}

export function duplicateWorkspacePage(
  source: WorkspacePage,
  input: { id: string, name: string, route: string },
): WorkspacePage {
  const prefix = safeProjectSlug(input.id)
  const ids = collectNodeIds(source.model.nodes)
  const idMap = Object.fromEntries(ids.map((id, index) => [id, `${prefix}-node-${index + 1}`]))
  const model = {
    ...structuredClone(source.model),
    nodes: source.model.nodes.map(node => duplicatePageNode(node, idMap)),
  }
  return {
    id: input.id,
    model: { ...model, id: input.id, name: input.name },
    name: input.name,
    route: normalizeWorkspacePageRoute(input.route),
  }
}

export function nextWorkspacePageRoute(application: WorkspaceApplication, name: string): string {
  const base = `/${safeProjectSlug(name)}`
  const routes = new Set(application.pages.map(page => page.route))
  if (!routes.has(base))
    return base
  let suffix = 2
  while (routes.has(`${base}-${suffix}`))
    suffix += 1
  return `${base}-${suffix}`
}

export function nextWorkspacePageId(application: WorkspaceApplication, name: string): string {
  const base = safeProjectSlug(name)
  const ids = new Set(application.pages.map(page => page.id))
  if (!ids.has(base))
    return base
  let suffix = 2
  while (ids.has(`${base}-${suffix}`))
    suffix += 1
  return `${base}-${suffix}`
}
