import type { ProjectDocument, ProjectSurface, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import { safeProjectSlug } from '../utils'

export function listProjectSurfaces(
  document: ProjectDocument | ReadonlyProjectDocument,
): ProjectSurface[] {
  return document.surfaceOrder.map((surfaceId) => {
    const surface = document.surfacesById[surfaceId]
    if (!surface)
      throw new TypeError(`PROJECT_SURFACE_UNKNOWN: Surface order references ${surfaceId}.`)
    return structuredClone(surface) as ProjectSurface
  })
}

export function normalizeProjectSurfaceRoute(route: string): string {
  const normalized = `/${route.trim().replace(/^\/+|\/+$/g, '')}`
  return normalized === '/' ? '/' : normalized.replace(/\/{2,}/g, '/')
}

export function nextProjectSurfaceId(
  document: ProjectDocument | ReadonlyProjectDocument,
  name: string,
): string {
  const base = safeProjectSlug(name)
  if (!document.surfacesById[base])
    return base
  let suffix = 2
  while (document.surfacesById[`${base}-${suffix}`])
    suffix += 1
  return `${base}-${suffix}`
}

export function nextProjectSurfaceRoute(
  document: ProjectDocument | ReadonlyProjectDocument,
  name: string,
): string {
  const base = normalizeProjectSurfaceRoute(safeProjectSlug(name))
  const routes = new Set(Object.values(document.surfacesById)
    .filter((surface): surface is Extract<ProjectSurface, { kind: 'page' }> => surface.kind === 'page')
    .map(surface => surface.route))
  if (!routes.has(base))
    return base
  let suffix = 2
  while (routes.has(`${base}-${suffix}`))
    suffix += 1
  return `${base}-${suffix}`
}

export function duplicateProjectSurface(
  surface: ProjectSurface | ReadonlyProjectDocument['surfacesById'][string],
  identity: { id: string, name: string, route?: string },
): ProjectSurface {
  const clone = structuredClone(surface) as ProjectSurface
  if (clone.kind === 'page' && identity.route !== undefined)
    clone.route = identity.route
  clone.id = identity.id
  clone.name = identity.name
  return clone
}
