/**
 * Minimal structural view of a project document.
 *
 * The workspace holds a deeply frozen document, so the route layer reads only
 * page existence instead of the full Surface contract.
 */
export interface WorkbenchPageSource {
  readonly surfacesById: Readonly<Record<string, unknown>>
}

/**
 * Whether a route's `pageId` still exists in the open project.
 *
 * A route may name a page that was removed in another session, or one that never
 * existed. The sync layer then returns to page management instead of rendering a
 * designer for a page that is gone.
 */
export function hasWorkbenchPage(document: WorkbenchPageSource, pageId: string): boolean {
  return pageId in document.surfacesById
}

/**
 * Decides whether a route change may switch the open project.
 *
 * Switching projects is blocked while the current project has unsaved work or an
 * unresolved configuration error, matching the existing Workbench command
 * contract. Navigation inside the same project and navigation that leaves the
 * project entirely (back to the projects list) always pass.
 */
export function shouldBlockProjectSwitch(input: {
  readonly openProjectId?: string
  readonly targetProjectId?: string
  readonly hasUnsavedChanges: boolean
}): boolean {
  return input.hasUnsavedChanges
    && Boolean(input.openProjectId)
    && Boolean(input.targetProjectId)
    && input.openProjectId !== input.targetProjectId
}
