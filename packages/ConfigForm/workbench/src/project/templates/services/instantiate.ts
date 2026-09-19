import type { ProjectDocument, ProjectSurface } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter } from '../../../adapters'
import type { ProjectIdentityFactory } from '../../types'
import type {
  InstantiateTemplateProjectInput,
  InstantiateTemplateSurfaceInput,
  PreparedTemplatePreview,
  ProjectTemplateCatalogEntry,
} from '../types'
import {
  assertProjectDocument,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  projectSurfaceSchema,
} from '@moluoxixi/config-form-model'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../../defaults'
import { prepareIsolatedProjectPreview, remapProjectSurfaceIdentity } from '../../services'
import { getProjectTemplateSeedFingerprint, registryLockFromSnapshot } from './catalog'

function assertProjectTemplateSurfaceKind(template: ProjectTemplateCatalogEntry): void {
  if (template.surface.kind !== 'page') {
    throw new TypeError(
      `TEMPLATE_TARGET_KIND_INVALID: ${template.surface.kind} templates can only create Surfaces.`,
    )
  }
}

export function instantiateTemplateSurface(
  template: ProjectTemplateCatalogEntry,
  input: InstantiateTemplateSurfaceInput,
): ProjectSurface {
  const remapped = remapProjectSurfaceIdentity(
    template.surface,
    input.id,
    input.identityFactory,
    {
      datasets: new Map(),
      resources: new Map(),
      surfaces: new Map([[template.surface.id, input.id]]),
    },
  )
  const surface = { ...remapped.surface, name: input.name }
  if (surface.kind === 'page' && input.route !== undefined)
    surface.route = input.route
  const result = projectSurfaceSchema.safeParse(surface)
  if (!result.success)
    throw new TypeError(`TEMPLATE_SURFACE_INVALID: ${result.error.issues[0]?.message ?? 'Template Surface is invalid.'}`)
  return structuredClone(result.data)
}

export function instantiateTemplateProject(
  template: ProjectTemplateCatalogEntry,
  input: InstantiateTemplateProjectInput,
): ProjectDocument {
  assertProjectTemplateSurfaceKind(template)
  const factory = input.identityFactory ?? DEFAULT_PROJECT_IDENTITY_FACTORY
  const projectId = input.id ?? factory.create('project', template.manifest.id)
  const surfaceId = factory.create('surface', template.surface.id)
  const surface = instantiateTemplateSurface(template, {
    id: surfaceId,
    identityFactory: factory,
    name: input.name,
    route: '/',
  })
  return assertProjectDocument({
    version: PROJECT_DOCUMENT_VERSION,
    id: projectId,
    name: input.name,
    homeSurfaceId: surface.id,
    surfaceOrder: [surface.id],
    surfacesById: { [surface.id]: surface },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(input.registryLock),
    settings: {},
  })
}

export function prepareTemplatePreview(
  template: ProjectTemplateCatalogEntry,
  adapter: Pick<WorkbenchAdapter, 'designerRegistry' | 'registrySnapshot'>,
  identityFactory?: ProjectIdentityFactory,
): PreparedTemplatePreview {
  assertProjectTemplateSurfaceKind(template)
  const project = instantiateTemplateProject(template, {
    identityFactory,
    name: template.manifest.displayName,
    registryLock: registryLockFromSnapshot(adapter.registrySnapshot),
  })
  return prepareIsolatedProjectPreview({
    adapter,
    adapterId: template.manifest.adapter,
    document: project,
    surfaceId: project.homeSurfaceId,
    revision: `template:${template.manifest.id}:${getProjectTemplateSeedFingerprint(template)}:${project.id}`,
  })
}
