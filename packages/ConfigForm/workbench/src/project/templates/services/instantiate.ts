import type { ProjectDocument, ProjectSurface, RegistryLock } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter } from '../../../adapters'
import type { ProjectIdentityFactory } from '../../types'
import type {
  InstantiateTemplateProjectInput,
  InstantiateTemplateSurfaceInput,
  PreparedTemplatePreview,
  ProjectTemplateCatalogEntry,
  TemplateCreationTarget,
} from '../types'
import {
  assertProjectDocument,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  projectSurfaceSchema,
  SURFACE_GRAPH_VERSION,
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

function instantiateTemplateSurfacePreviewProject(
  template: ProjectTemplateCatalogEntry,
  registryLock: RegistryLock,
  identityFactory: ProjectIdentityFactory = DEFAULT_PROJECT_IDENTITY_FACTORY,
): { document: ProjectDocument, surfaceId: string } {
  const projectId = identityFactory.create('project', `${template.manifest.id}-preview`)
  const surfaceId = identityFactory.create('surface', template.surface.id)
  const surface = instantiateTemplateSurface(template, {
    id: surfaceId,
    identityFactory,
    name: template.manifest.displayName,
    route: '/',
  })
  if (surface.kind === 'page') {
    return {
      document: assertProjectDocument({
        version: PROJECT_DOCUMENT_VERSION,
        id: projectId,
        name: template.manifest.displayName,
        homeSurfaceId: surface.id,
        surfaceOrder: [surface.id],
        surfacesById: { [surface.id]: surface },
        datasetOrder: [],
        datasetsById: {},
        resources: {},
        theme: { version: PROJECT_THEME_VERSION },
        registryLock: structuredClone(registryLock),
        settings: {},
      }),
      surfaceId: surface.id,
    }
  }

  const homeSurfaceId = identityFactory.create('surface', 'template-preview-home')
  return {
    document: assertProjectDocument({
      version: PROJECT_DOCUMENT_VERSION,
      id: projectId,
      name: template.manifest.displayName,
      homeSurfaceId,
      surfaceOrder: [homeSurfaceId, surface.id],
      surfacesById: {
        [homeSurfaceId]: {
          id: homeSurfaceId,
          kind: 'page',
          name: 'Template preview home',
          route: '/',
          parameters: [],
          outputs: [],
          interactions: [],
          graph: {
            version: SURFACE_GRAPH_VERSION,
            props: {},
            form: {},
            root: [],
            nodesById: {},
          },
        },
        [surface.id]: surface,
      },
      datasetOrder: [],
      datasetsById: {},
      resources: {},
      theme: { version: PROJECT_THEME_VERSION },
      registryLock: structuredClone(registryLock),
      settings: {},
    }),
    surfaceId: surface.id,
  }
}

export function prepareTemplatePreview(
  template: ProjectTemplateCatalogEntry,
  adapter: Pick<WorkbenchAdapter, 'designerRegistry' | 'registrySnapshot'>,
  target: TemplateCreationTarget,
  identityFactory?: ProjectIdentityFactory,
): PreparedTemplatePreview {
  const registryLock = registryLockFromSnapshot(adapter.registrySnapshot)
  const prepared = target === 'project'
    ? (() => {
        const document = instantiateTemplateProject(template, {
          identityFactory,
          name: template.manifest.displayName,
          registryLock,
        })
        return { document, surfaceId: document.homeSurfaceId }
      })()
    : instantiateTemplateSurfacePreviewProject(template, registryLock, identityFactory)
  return prepareIsolatedProjectPreview({
    adapter,
    adapterId: template.manifest.adapter,
    document: prepared.document,
    surfaceId: prepared.surfaceId,
    revision: `template:${template.manifest.id}:${getProjectTemplateSeedFingerprint(template)}:${prepared.document.id}`,
  })
}
