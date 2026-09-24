import type { RouteLocationNormalized, Router, RouteRecordRaw } from 'vue-router'
import type { WorkbenchRouteTarget } from './types'
import { createRouter, createWebHashHistory } from 'vue-router'

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

/**
 * Route table of the Workbench/Studio application.
 *
 * Route components are lazy so the projects list stays the only eager screen and
 * the designer, creation workspace, and asset editors keep their existing
 * code-splitting boundaries.
 */
export const WORKBENCH_ROUTES: readonly RouteRecordRaw[] = [
  {
    path: '/',
    redirect: WORKBENCH_PATHS.projects,
  },
  {
    path: WORKBENCH_PATHS.projects,
    name: 'projects',
    component: () => import('../components/ProjectsView.vue'),
  },
  {
    path: WORKBENCH_PATHS.projectCreate,
    name: 'project-create',
    component: () => import('../components/CreationView.vue'),
    props: { mode: 'template' as const, target: 'project' as const },
  },
  {
    path: WORKBENCH_PATHS.projectImport,
    name: 'project-import',
    component: () => import('../components/CreationView.vue'),
    props: { mode: 'json' as const, target: 'project' as const },
  },
  {
    path: WORKBENCH_PATHS.projectPages,
    name: 'project-pages',
    component: () => import('../components/PagesView.vue'),
  },
  {
    path: WORKBENCH_PATHS.pageCreate,
    name: 'page-create',
    component: () => import('../components/CreationView.vue'),
    props: { mode: 'template' as const, target: 'surface' as const },
  },
  {
    path: WORKBENCH_PATHS.pageDesign,
    name: 'page-design',
    component: () => import('../components/DesignView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: WORKBENCH_PATHS.projects,
  },
]

export interface WorkbenchRouterOptions {
  /**
   * Hash history base. Defaults to `location.pathname`, which keeps deep links
   * working for every published entry (`index.html`, `designer.html`) without a
   * server rewrite.
   */
  readonly base?: string
}

export function createWorkbenchRouter(options: WorkbenchRouterOptions = {}): Router {
  return createRouter({
    history: createWebHashHistory(options.base),
    routes: [...WORKBENCH_ROUTES],
  })
}

export * from './services'
export type * from './types'
