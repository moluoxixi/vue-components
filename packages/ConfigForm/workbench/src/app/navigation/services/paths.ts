import type { RouteLocationNormalized } from 'vue-router'
import type { WorkbenchRouteTarget } from '../types'

/**
 * Canonical Workbench/Studio route paths.
 *
 * The hierarchy is project › page › design: a project owns pages, and the form
 * designer belongs to one page. `/projects/new` and `/projects/import` are two
 * segments deep while every project-scoped path is at least three, so a static
 * segment can never shadow a real project id.
 */
export const WORKBENCH_PATHS = Object.freeze({
  projects: '/projects',
  templates: '/templates',
  templateDesign: '/templates/:templateId/design',
  projectCreate: '/projects/new',
  projectImport: '/projects/import',
  projectPages: '/projects/:projectId/pages',
  pageCreate: '/projects/:projectId/pages/new',
  pageDesign: '/projects/:projectId/pages/:pageId/design',
})

export const WORKBENCH_HOME_PATH = WORKBENCH_PATHS.projects

function encodeSegment(value: string): string {
  return encodeURIComponent(value)
}

export function projectsPath(): string {
  return WORKBENCH_PATHS.projects
}

export function templatesPath(): string {
  return WORKBENCH_PATHS.templates
}

export function templateDesignPath(templateId: string): string {
  return `${WORKBENCH_PATHS.templates}/${encodeSegment(templateId)}/design`
}

export function projectCreatePath(mode: 'json' | 'template'): string {
  return mode === 'json' ? WORKBENCH_PATHS.projectImport : WORKBENCH_PATHS.projectCreate
}

/** Page management of one project: the list a project's work starts from. */
export function projectPagesPath(projectId: string): string {
  return `${WORKBENCH_PATHS.projects}/${encodeSegment(projectId)}/pages`
}

/** Create a page inside a project. */
export function pageCreatePath(projectId: string): string {
  return `${projectPagesPath(projectId)}/new`
}

/**
 * The form designer of one page.
 *
 * `pageId` carries the Surface id of any kind (page, dialog, or drawer): page
 * management lists all three and they share one designer.
 */
export function pageDesignPath(projectId: string, pageId: string): string {
  return `${projectPagesPath(projectId)}/${encodeSegment(pageId)}/design`
}

function readParam(value: unknown): string | undefined {
  if (Array.isArray(value))
    return typeof value[0] === 'string' && value[0] ? value[0] : undefined
  return typeof value === 'string' && value ? value : undefined
}

/**
 * Reads the project/page target of a resolved route.
 *
 * Unknown or malformed routes resolve to an empty target so the route sync layer
 * can normalize the URL instead of rendering a half-open workspace.
 */
export function readWorkbenchRouteTarget(route: Pick<RouteLocationNormalized, 'params'>): WorkbenchRouteTarget {
  const projectId = readParam(route.params.projectId)
  const pageId = readParam(route.params.pageId)
  return {
    ...(projectId ? { projectId } : {}),
    ...(pageId ? { pageId } : {}),
  }
}

/** Routes that need an open project session, and therefore a project in the URL. */
export function isProjectRouteName(name: unknown): boolean {
  return name === 'project-pages'
    || name === 'page-create'
    || name === 'page-design'
}
