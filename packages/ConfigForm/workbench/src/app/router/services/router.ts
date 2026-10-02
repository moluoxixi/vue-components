import type { Router, RouteRecordRaw } from 'vue-router'
import type { WorkbenchRouterOptions } from '../types'
import { createRouter, createWebHashHistory } from 'vue-router'
import { WORKBENCH_PATHS } from '../../navigation'

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
    component: () => import('../components/ProjectCreationView.vue'),
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

export function createWorkbenchRouter(options: WorkbenchRouterOptions = {}): Router {
  return createRouter({
    history: createWebHashHistory(options.base),
    routes: [...WORKBENCH_ROUTES],
  })
}
