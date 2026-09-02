import type { ProjectDocument, ProjectPage, RegistryLock } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../../adapters'
import type {
  CanonicalImportPayload,
  ConfigImportDiagnostic,
  PrepareConfigImportOptions,
  PrepareConfigImportResult,
} from '../types'
import { compileCanonicalPage } from '@moluoxixi/config-form-compiler'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import {
  assertProjectDocument,
  createProjectSnapshot,
  getProjectDocumentContentHash,
  projectPageSchema,
  registryLockFingerprint,
} from '@moluoxixi/config-form-model'
import { loadWorkbenchAdapter } from '../../../adapters'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../../defaults'
import { prepareIsolatedProjectPreview } from '../../services'
import { parseConfigImportPayload } from '../schemas/current'
import {
  appendConfigImportPath,
  guardConfigImportValue,
  MAX_IMPORT_NODES,
  MAX_IMPORT_PAGES,
  parseConfigImportSource,
} from '../schemas/guard'
import { instantiateImportedPage, instantiateImportedProject } from './identity'

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
          : '$.page.graph.nodesById',
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

function validateProjectRegistry(
  source: ProjectDocument,
  adapter: WorkbenchAdapter,
): ConfigImportDiagnostic[] {
  const expected = adapter.componentRegistry.lock
  const lockDiagnostics = adapter.componentRegistry.analyzeLock(source.registryLock)
  const sourceComponents = Object.keys(source.registryLock.components).sort((left, right) => left.localeCompare(right))
  const expectedComponents = Object.keys(expected.components).sort((left, right) => left.localeCompare(right))
  if (source.registryLock.fingerprint !== expected.fingerprint
    || sourceComponents.length !== expectedComponents.length
    || sourceComponents.some((component, index) => component !== expectedComponents[index])) {
    lockDiagnostics.push({
      code: 'MODEL_REGISTRY_FINGERPRINT_MISMATCH',
      message: 'Project Registry lock must exactly match the active Registry.',
      path: ['components'],
    })
  }
  return lockDiagnostics.map(item => ({
    code: 'IMPORT_REGISTRY_INVALID',
    message: item.message,
    path: (item.path ?? []).reduce<string>((path, segment) => appendConfigImportPath(path, segment), '$.registryLock'),
  }))
}

function validatePageRegistry(
  page: ProjectPage,
  transferLock: RegistryLock,
  project: ProjectDocument,
  adapter: WorkbenchAdapter,
): ConfigImportDiagnostic[] {
  const diagnostics: ConfigImportDiagnostic[] = []
  const components = new Set(Object.values(page.graph.nodesById).map(node => node.component))
  if (
    transferLock.adapter !== project.registryLock.adapter
    || transferLock.adapter !== adapter.componentRegistry.lock.adapter
    || transferLock.version !== project.registryLock.version
    || transferLock.version !== adapter.componentRegistry.lock.version
  ) {
    diagnostics.push({
      code: 'IMPORT_REGISTRY_INVALID',
      message: 'Page transfer Registry adapter or version does not match the current project.',
      path: '$.registryLock',
    })
  }
  const transferKeys = Object.keys(transferLock.components)
  if (transferKeys.length !== components.size || transferKeys.some(component => !components.has(component))) {
    diagnostics.push({
      code: 'IMPORT_REGISTRY_INVALID',
      message: 'Page transfer Registry lock must contain exactly the components used by the page.',
      path: '$.registryLock.components',
    })
  }
  if (transferLock.fingerprint !== registryLockFingerprint(transferLock.components)) {
    diagnostics.push({
      code: 'IMPORT_REGISTRY_INVALID',
      message: 'Page transfer Registry fingerprint does not match its component contracts.',
      path: '$.registryLock.fingerprint',
    })
  }
  for (const component of components) {
    const transferred = transferLock.components[component]
    const expected = project.registryLock.components[component]
    const available = adapter.componentRegistry.lock.components[component]
    if (!transferred || !expected || !available) {
      diagnostics.push({
        code: 'IMPORT_REGISTRY_INVALID',
        message: !transferred
          ? `The Page transfer Registry lock does not contain ${component}.`
          : !expected
              ? `The current project Registry lock does not contain ${component}.`
              : `Component is unavailable: ${component}.`,
        path: `$.page.graph.nodesById`,
      })
      continue
    }
    if (
      transferred.contractVersion !== available.contractVersion
      || transferred.fingerprint !== available.fingerprint
      || expected.contractVersion !== available.contractVersion
      || expected.fingerprint !== available.fingerprint
    ) {
      diagnostics.push({
        code: 'IMPORT_REGISTRY_INVALID',
        message: `Component contract does not match the current project: ${component}.`,
        path: `$.page.graph.nodesById`,
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
    version: document.version,
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
  const current = parseConfigImportPayload(parsed.value, options.target)
  if (!current.success)
    return current
  const modelBudgetDiagnostics = guardCanonicalConfigImportBudgets(current.payload)
  if (modelBudgetDiagnostics.length > 0)
    return { success: false, diagnostics: modelBudgetDiagnostics }

  const loadAdapter = options.loadAdapter ?? loadWorkbenchAdapter
  const identityFactory = options.identityFactory ?? DEFAULT_PROJECT_IDENTITY_FACTORY
  if (current.payload.target === 'project') {
    const id = adapterId(current.payload.document.registryLock.adapter)
    if (!id)
      return fail('IMPORT_ADAPTER_UNSUPPORTED', `Unsupported Workbench adapter: ${current.payload.document.registryLock.adapter}.`, '$.registryLock.adapter')
    const adapter = await loadAdapter(id)
    const registryDiagnostics = validateProjectRegistry(current.payload.document, adapter)
    if (registryDiagnostics.length > 0)
      return { success: false, diagnostics: registryDiagnostics }
    const document = instantiateImportedProject(current.payload.document, identityFactory)
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
  const registryDiagnostics = validatePageRegistry(current.payload.page, current.payload.registryLock, currentProject, adapter)
  if (registryDiagnostics.length > 0)
    return { success: false, diagnostics: registryDiagnostics }
  const remapped = instantiateImportedPage(current.payload.page, identityFactory)
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
          : 'IMPORT_REGISTRY_INVALID',
        message: identityFailure
          ? 'The document contains invalid or duplicate typed identities.'
          : 'The import could not be prepared with the selected adapter and Registry.',
        path: '$',
      }],
    }
  }
}
