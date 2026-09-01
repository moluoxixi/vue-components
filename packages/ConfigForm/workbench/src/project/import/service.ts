import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../adapters'
import type { ProjectIdentityFactory } from '../identity-remap'
import type { CanonicalImportPayload } from './migrations'
import type {
  ConfigImportDiagnostic,
  ConfigImportMigrationRecord,
  ConfigImportTarget,
  PrepareConfigImportResult,
} from './types'
import { compileCanonicalPage } from '@moluoxixi/config-form-compiler'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import {
  assertProjectDocument,
  createProjectRegistryLock,
  createProjectSnapshot,
  getProjectDocumentContentHash,
  projectPageSchema,
} from '@moluoxixi/config-form-model'
import { loadWorkbenchAdapter } from '../../adapters'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../identity-remap'
import { prepareIsolatedProjectPreview } from '../isolated-preview'
import {
  appendConfigImportPath,
  guardConfigImportValue,
  MAX_IMPORT_NODES,
  MAX_IMPORT_PAGES,
  parseConfigImportSource,
} from './guard'
import { instantiateImportedPage, instantiateImportedProject } from './identity'
import { migrateConfigImportPayload } from './migrations'

export interface PrepareConfigImportOptions {
  currentProject?: ProjectDocument
  identityFactory?: ProjectIdentityFactory
  loadAdapter?: (id: WorkbenchAdapterId) => Promise<WorkbenchAdapter>
  source: string
  target: ConfigImportTarget
}

function fail(
  code: ConfigImportDiagnostic['code'],
  message: string,
  path = '$',
): PrepareConfigImportResult {
  return { success: false, diagnostics: [{ code, message, path }] }
}

export function guardCanonicalConfigImportBudgets(
  payload: CanonicalImportPayload,
): ConfigImportDiagnostic[] {
  const pages = payload.target === 'project'
    ? Object.values(payload.document.pagesById)
    : [payload.page]
  if (pages.length > MAX_IMPORT_PAGES) {
    return [{
      code: 'IMPORT_PAGE_LIMIT_EXCEEDED',
      message: `Project contains ${pages.length} pages; the limit is ${MAX_IMPORT_PAGES}.`,
      path: '$.pagesById',
    }]
  }
  let nodes = 0
  for (const page of pages) {
    nodes += Object.keys(page.graph.nodesById).length
    if (nodes > MAX_IMPORT_NODES) {
      return [{
        code: 'IMPORT_NODE_LIMIT_EXCEEDED',
        message: `Import contains ${nodes} nodes; the limit is ${MAX_IMPORT_NODES}.`,
        path: payload.target === 'project'
          ? `${appendConfigImportPath('$.pagesById', page.id)}.graph.nodesById`
          : '$.graph.nodesById',
      }]
    }
  }
  return []
}

function adapterId(value: string): WorkbenchAdapterId | undefined {
  return value === 'antd-vue' || value === 'element-plus' ? value : undefined
}

function compileProject(document: ProjectDocument, adapter: WorkbenchAdapter): ConfigImportDiagnostic[] {
  const snapshot = createProjectSnapshot(document, 0)
  for (const pageId of document.pageOrder) {
    const compiled = compileCanonicalPage({
      snapshot: {
        document: snapshot.document,
        editVersion: snapshot.editVersion,
        contentHash: snapshot.contentHash,
      },
      pageId,
      registry: adapter.registrySnapshot,
    })
    if (!compiled.success) {
      const pagePath = appendConfigImportPath('$.pagesById', pageId)
      return compiled.diagnostics.map(item => ({
        code: 'IMPORT_PREVIEW_COMPILE_FAILED',
        message: item.message,
        path: item.nodeId
          ? appendConfigImportPath(`${pagePath}.graph.nodesById`, item.nodeId)
          : pagePath,
      }))
    }
  }
  return []
}

function migrateProjectComponents(
  source: ProjectDocument,
  adapter: WorkbenchAdapter,
):
  | { success: true, document: ProjectDocument, migrations: ConfigImportMigrationRecord[] }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  const lockDiagnostics = adapter.componentRegistry.analyzeLock(source.registryLock)
  const blocking = lockDiagnostics.filter(item => item.code !== 'MODEL_REGISTRY_COMPONENT_MIGRATION_REQUIRED')
  if (blocking.length > 0) {
    return {
      success: false,
      diagnostics: blocking.map(item => ({
        code: 'IMPORT_REGISTRY_INCOMPATIBLE',
        message: item.message,
        path: (item.path ?? []).reduce<string>((path, segment) => appendConfigImportPath(path, segment), '$.registryLock'),
      })),
    }
  }

  const candidate = structuredClone(source) as ProjectDocument
  const migrations: ConfigImportMigrationRecord[] = []
  const migrationComponents = new Set(lockDiagnostics.flatMap(item =>
    item.code === 'MODEL_REGISTRY_COMPONENT_MIGRATION_REQUIRED' && typeof item.path?.[1] === 'string'
      ? [item.path[1]]
      : []))
  for (const component of migrationComponents) {
    const fromVersion = source.registryLock.components[component]?.contractVersion
    if (!fromVersion)
      return { success: false, diagnostics: [{ code: 'IMPORT_REGISTRY_INCOMPATIBLE', message: `Registry lock is missing ${component}.`, path: appendConfigImportPath('$.registryLock.components', component) }] }
    for (const page of Object.values(candidate.pagesById)) {
      for (const [nodeId, node] of Object.entries(page.graph.nodesById)) {
        if (node.component !== component)
          continue
        const result = adapter.componentRegistry.migrateNode(node, fromVersion)
        if (!result.success) {
          return {
            success: false,
            diagnostics: result.diagnostics.map(item => ({
              code: 'IMPORT_COMPONENT_MIGRATION_FAILED',
              message: item.message,
              path: appendConfigImportPath(
                `${appendConfigImportPath('$.pagesById', page.id)}.graph.nodesById`,
                nodeId,
              ),
            })),
          }
        }
        page.graph.nodesById[nodeId] = result.node
      }
    }
    migrations.push({
      code: 'IMPORT_COMPONENT_MIGRATED',
      fromVersion,
      message: `Migrated ${component} to the available Registry contract.`,
      path: appendConfigImportPath('$.registryLock.components', component),
      toVersion: adapter.componentRegistry.get(component)!.version,
    })
  }
  candidate.registryLock = createProjectRegistryLock(candidate, adapter.componentRegistry)
  return { success: true, document: assertProjectDocument(candidate), migrations }
}

function validatePageRegistry(
  page: ProjectPage,
  project: ProjectDocument,
  adapter: WorkbenchAdapter,
): ConfigImportDiagnostic[] {
  const diagnostics: ConfigImportDiagnostic[] = []
  const components = new Set(Object.values(page.graph.nodesById).map(node => node.component))
  for (const component of components) {
    const expected = project.registryLock.components[component]
    const available = adapter.componentRegistry.lock.components[component]
    if (!expected || !available) {
      diagnostics.push({
        code: 'IMPORT_REGISTRY_INCOMPATIBLE',
        message: !expected
          ? `The current project Registry lock does not contain ${component}.`
          : `Component is unavailable: ${component}.`,
        path: `$.graph.nodesById`,
      })
      continue
    }
    if (
      expected.contractVersion !== available.contractVersion
      || expected.fingerprint !== available.fingerprint
    ) {
      diagnostics.push({
        code: 'IMPORT_REGISTRY_INCOMPATIBLE',
        message: `Component contract does not match the current project: ${component}.`,
        path: `$.graph.nodesById`,
      })
    }
  }
  return diagnostics
}

function uniquePageRoute(document: ProjectDocument, requested: string): string {
  const used = new Set(Object.values(document.pagesById).map(page => page.route))
  if (!used.has(requested))
    return requested
  const base = requested === '/' ? '/imported' : requested.replace(/\/$/, '')
  let index = 1
  while (used.has(`${base}-${index}`))
    index += 1
  return `${base}-${index}`
}

function projectSummary(document: ProjectDocument) {
  const pages = Object.values(document.pagesById)
  return {
    adapter: document.registryLock.adapter as WorkbenchAdapterId,
    flowCount: pages.reduce((count, page) => count + (page.flows?.length ?? 0), 0),
    name: document.name,
    nodeCount: pages.reduce((count, page) => count + Object.keys(page.graph.nodesById).length, 0),
    pageCount: pages.length,
    pageGraphVersion: pages[0]!.graph.version,
    resourceCount: Object.keys(document.resources).length,
    schemaVersion: document.schemaVersion,
    target: 'project' as const,
  }
}

function pageSummary(page: ProjectPage, adapter: WorkbenchAdapterId) {
  return {
    adapter,
    flowCount: page.flows?.length ?? 0,
    name: page.name,
    nodeCount: Object.keys(page.graph.nodesById).length,
    pageCount: 1,
    pageGraphVersion: page.graph.version,
    resourceCount: 0,
    target: 'page' as const,
  }
}

async function prepareConfigImportUnsafe(
  options: PrepareConfigImportOptions,
): Promise<PrepareConfigImportResult> {
  const parsed = parseConfigImportSource(options.source)
  if (!parsed.success)
    return parsed
  const guardDiagnostics = guardConfigImportValue(parsed.value)
  if (guardDiagnostics.length > 0)
    return { success: false, diagnostics: guardDiagnostics }
  const migrated = migrateConfigImportPayload(parsed.value, options.target)
  if (!migrated.success)
    return migrated
  const modelBudgetDiagnostics = guardCanonicalConfigImportBudgets(migrated.payload)
  if (modelBudgetDiagnostics.length > 0)
    return { success: false, diagnostics: modelBudgetDiagnostics }

  const loadAdapter = options.loadAdapter ?? loadWorkbenchAdapter
  const identityFactory = options.identityFactory ?? DEFAULT_PROJECT_IDENTITY_FACTORY
  if (migrated.payload.target === 'project') {
    const id = adapterId(migrated.payload.document.registryLock.adapter)
    if (!id)
      return fail('IMPORT_ADAPTER_UNSUPPORTED', `Unsupported Workbench adapter: ${migrated.payload.document.registryLock.adapter}.`, '$.registryLock.adapter')
    const adapter = await loadAdapter(id)
    const compatible = migrateProjectComponents(migrated.payload.document, adapter)
    if (!compatible.success)
      return compatible
    const document = instantiateImportedProject(compatible.document, identityFactory)
    const compileDiagnostics = compileProject(document, adapter)
    if (compileDiagnostics.length > 0)
      return { success: false, diagnostics: compileDiagnostics }
    const preview = prepareIsolatedProjectPreview({
      adapter,
      adapterId: id,
      document,
      pageId: document.homePageId,
      revision: `import:${getConfigFormJsonSemanticHash(document)}`,
    })
    return {
      success: true,
      prepared: {
        adapter: id,
        diagnostics: [],
        document,
        migrations: [...migrated.payload.migrations, ...compatible.migrations],
        preview,
        previewCompilation: preview.compilation,
        summary: projectSummary(document),
        target: 'project',
      },
    }
  }

  const currentProject = options.currentProject
  if (!currentProject)
    return fail('IMPORT_TARGET_MISMATCH', 'Page import requires an active project.')
  const id = adapterId(currentProject.registryLock.adapter)
  if (!id)
    return fail('IMPORT_ADAPTER_UNSUPPORTED', `Unsupported Workbench adapter: ${currentProject.registryLock.adapter}.`, '$.registryLock.adapter')
  const adapter = await loadAdapter(id)
  const registryDiagnostics = validatePageRegistry(migrated.payload.page, currentProject, adapter)
  if (registryDiagnostics.length > 0)
    return { success: false, diagnostics: registryDiagnostics }
  const remapped = instantiateImportedPage(migrated.payload.page, identityFactory)
  const pageResult = projectPageSchema.safeParse({
    ...remapped,
    route: uniquePageRoute(currentProject, remapped.route),
  })
  if (!pageResult.success) {
    return {
      success: false,
      diagnostics: pageResult.error.issues.map(issue => ({
        code: 'IMPORT_PAGE_INVALID',
        message: issue.message,
        path: issue.path.reduce<string>(
          (path, segment) => appendConfigImportPath(path, segment),
          '$',
        ),
      })),
    }
  }
  const page = structuredClone(pageResult.data)
  const candidate = structuredClone(currentProject) as ProjectDocument
  candidate.pageOrder.push(page.id)
  candidate.pagesById[page.id] = page
  const document = assertProjectDocument(candidate)
  const compileDiagnostics = compileProject(document, adapter)
  if (compileDiagnostics.length > 0)
    return { success: false, diagnostics: compileDiagnostics }
  const preview = prepareIsolatedProjectPreview({
    adapter,
    adapterId: id,
    document,
    pageId: page.id,
    revision: `import:${getConfigFormJsonSemanticHash(page)}`,
  })
  return {
    success: true,
    prepared: {
      adapter: id,
      diagnostics: [],
      migrations: migrated.payload.migrations,
      originContentHash: getProjectDocumentContentHash(currentProject),
      originProjectId: currentProject.id,
      page,
      preview,
      previewCompilation: preview.compilation,
      summary: pageSummary(page, id),
      target: 'page',
    },
  }
}

export async function prepareConfigImport(
  options: PrepareConfigImportOptions,
): Promise<PrepareConfigImportResult> {
  try {
    return await prepareConfigImportUnsafe(options)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const identityFailure = message.includes('TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED')
      || message.includes('PROJECT_DOCUMENT_')
    return {
      success: false,
      diagnostics: [{
        code: identityFailure
          ? options.target === 'page' ? 'IMPORT_PAGE_INVALID' : 'IMPORT_PROJECT_INVALID'
          : 'IMPORT_REGISTRY_INCOMPATIBLE',
        message: identityFailure
          ? 'The document contains invalid or duplicate typed identities.'
          : 'The import could not be prepared with the selected adapter and Registry.',
        path: '$',
      }],
    }
  }
}
