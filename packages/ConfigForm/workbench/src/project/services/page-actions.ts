import type { ProjectDocument, ProjectPage, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import { safeProjectSlug } from '../utils'

export function listProjectPages(
  document: ProjectDocument | ReadonlyProjectDocument,
): ProjectPage[] {
  return document.pageOrder.map((pageId) => {
    const page = document.pagesById[pageId]
    if (!page)
      throw new TypeError(`PROJECT_PAGE_UNKNOWN: Page order references ${pageId}.`)
    return structuredClone(page) as ProjectPage
  })
}

export function normalizeProjectPageRoute(route: string): string {
  const normalized = `/${route.trim().replace(/^\/+|\/+$/g, '')}`
  return normalized === '/' ? '/' : normalized.replace(/\/{2,}/g, '/')
}

export function nextProjectPageId(
  document: ProjectDocument | ReadonlyProjectDocument,
  name: string,
): string {
  const base = safeProjectSlug(name)
  if (!document.pagesById[base])
    return base
  let suffix = 2
  while (document.pagesById[`${base}-${suffix}`])
    suffix += 1
  return `${base}-${suffix}`
}

export function nextProjectPageRoute(
  document: ProjectDocument | ReadonlyProjectDocument,
  name: string,
): string {
  const base = normalizeProjectPageRoute(safeProjectSlug(name))
  const routes = new Set(Object.values(document.pagesById).map(page => page.route))
  if (!routes.has(base))
    return base
  let suffix = 2
  while (routes.has(`${base}-${suffix}`))
    suffix += 1
  return `${base}-${suffix}`
}

export function duplicateProjectPage(
  page: ProjectPage | ReadonlyProjectDocument['pagesById'][string],
  identity: Pick<ProjectPage, 'id' | 'name' | 'route'>,
): ProjectPage {
  return {
    ...structuredClone(page),
    ...identity,
  } as ProjectPage
}
