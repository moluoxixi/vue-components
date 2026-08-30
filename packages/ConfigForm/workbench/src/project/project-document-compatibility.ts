import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../adapters'
import type { WorkspaceApplication, WorkspaceApplicationSummary } from './application'
import { projectPageToLegacyLowCodePageModel } from '@moluoxixi/config-form-model'
import { parseWorkspaceApplication } from './application'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  createBuiltInWorkspaceApplication,
} from './templates'

function adapterId(value: string): WorkbenchAdapterId {
  if (value === 'antd-vue' || value === 'element-plus')
    return value
  throw new TypeError(`Unsupported Workbench adapter: ${value}`)
}

function fallbackTemplateId(adapter: WorkbenchAdapterId): string {
  return adapter === 'element-plus' ? 'element-profile' : 'antd-profile'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function templateForProject(document: ReadonlyProjectDocument): { id: string, version: number } {
  const legacy: unknown = document.settings.legacyTemplate
  if (isRecord(legacy)) {
    const id = legacy.id
    const version = legacy.version
    if (typeof id === 'string' && Number.isInteger(version) && BUILT_IN_WORKSPACE_TEMPLATES.has(id))
      return { id, version: Number(version) }
  }
  const id = fallbackTemplateId(adapterId(document.registryLock.adapter))
  return { id, version: BUILT_IN_WORKSPACE_TEMPLATES.get(id)!.version }
}

/**
 * Read-only compatibility projection for existing Pages and Export UI. It is
 * derived from ProjectDocument and must never be persisted or reduced back
 * into the domain model.
 */
export function projectDocumentToLegacyWorkspaceApplication(
  document: ReadonlyProjectDocument,
  persistence: { createdAt: string, repositoryRevision: number, updatedAt: string },
): WorkspaceApplication {
  const template = templateForProject(document)
  const scaffold = createBuiltInWorkspaceApplication(template.id, {
    createdAt: persistence.createdAt,
    id: document.id,
    name: document.name,
  })
  return parseWorkspaceApplication({
    ...scaffold,
    createdAt: persistence.createdAt,
    homePageId: document.homePageId,
    id: document.id,
    name: document.name,
    pages: document.pageOrder.map((pageId) => {
      const page = document.pagesById[pageId]
      if (!page)
        throw new TypeError(`Project page order references a missing page: ${pageId}`)
      return {
        id: page.id,
        name: page.name,
        route: page.route,
        model: projectPageToLegacyLowCodePageModel(page),
      }
    }),
    revision: persistence.repositoryRevision,
    template,
    updatedAt: persistence.updatedAt,
  })
}

export function projectSummaryToLegacyWorkspaceSummary(
  summary: ProjectSummary,
): WorkspaceApplicationSummary {
  const adapter = adapterId(summary.registryLock.adapter)
  return {
    adapter,
    homePageId: summary.homePageId,
    id: summary.id,
    name: summary.name,
    pageCount: summary.pageCount,
    revision: summary.repositoryRevision,
    templateId: fallbackTemplateId(adapter),
    updatedAt: summary.updatedAt,
  }
}
