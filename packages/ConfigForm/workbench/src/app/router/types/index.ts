/**
 * Route identity for the Workbench/Studio application shell.
 *
 * The shell is a real routed application: the URL owns which project and which
 * page are open, so a refresh, a shared link, and browser history all resolve to
 * the same workspace. Route names are the only supported way to navigate;
 * callers build paths through `app/router` instead of writing raw strings.
 *
 * The hierarchy is project › page › design. A `pageId` segment carries the
 * Surface id of any kind (page, dialog, or drawer), because page management
 * lists all three kinds and they share one form designer.
 */
export type WorkbenchRouteName
  = | 'projects'
    | 'project-create'
    | 'project-import'
    | 'project-pages'
    | 'page-create'
    | 'page-design'

/**
 * Resolved project/page target of a route.
 *
 * Both segments are absent on the projects list and the project creation
 * screens, and `pageId` is absent on page management, where no single page is
 * open.
 */
export interface WorkbenchRouteTarget {
  readonly pageId?: string
  readonly projectId?: string
}
