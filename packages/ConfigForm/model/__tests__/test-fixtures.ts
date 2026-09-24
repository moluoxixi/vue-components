import type {
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ProjectPageSurface,
  ProjectSurface,
  RegistryLock,
  SlotItem,
  SurfaceFieldNode,
  SurfaceNode,
} from '../index'
import {
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '../index'

export const TEST_REGISTRY_COMPONENTS: RegistryLock['components'] = {
  'test.element': { contractVersion: '1', fingerprint: 'fnv1a:11111111' },
  'test.input': { contractVersion: '1', fingerprint: 'fnv1a:22222222' },
  'test.layout': { contractVersion: '1', fingerprint: 'fnv1a:33333333' },
}

export const TEST_REGISTRY_LOCK: RegistryLock = {
  adapter: 'test-adapter',
  version: '1.0.0',
  fingerprint: registryLockFingerprint(TEST_REGISTRY_COMPONENTS),
  components: structuredClone(TEST_REGISTRY_COMPONENTS),
}

export function fieldNode(
  id = 'name',
  field = id,
  overrides: Partial<SurfaceFieldNode> = {},
): SurfaceFieldNode {
  return {
    id,
    component: 'test.input',
    kind: 'field',
    field,
    props: {},
    ...overrides,
  }
}

export function pageSurface(
  id = 'home',
  route = '/',
  nodesById: Record<string, SurfaceNode> = { name: fieldNode() },
  root: SlotItem[] = [{ nodeId: 'name', placement: {} }],
): ProjectPageSurface {
  return {
    id,
    kind: 'page',
    name: id === 'home' ? 'Home' : id,
    route,
    parameters: [],
    outputs: [],
    interactions: [],
    graph: {
      version: SURFACE_GRAPH_VERSION,
      props: {},
      form: {},
      root,
      nodesById,
    },
  }
}

export function dialogSurface(id = 'dialog'): ProjectSurface {
  return {
    id,
    kind: 'dialog',
    name: 'Dialog',
    parameters: [],
    outputs: [],
    interactions: [],
    presentation: {
      kind: 'dialog',
      title: 'Dialog',
      width: { desktop: { value: 480, unit: 'px' } },
      mask: true,
      close: { escape: true, mask: true, button: true },
    },
    graph: {
      version: SURFACE_GRAPH_VERSION,
      props: {},
      form: {},
      root: [],
      nodesById: {},
    },
  }
}

export function documentFixture(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: { home: pageSurface() },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(TEST_REGISTRY_LOCK),
    settings: {},
    ...overrides,
  }
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', copy.buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function embeddedResourceFixture(
  bytes = new Uint8Array([1, 2, 3]),
  id = 'asset',
): Promise<{ document: ProjectDocument, write: ProjectEmbeddedResourceWrite }> {
  const contentHash = await sha256(bytes)
  return {
    document: documentFixture({
      resources: {
        [id]: {
          id,
          kind: 'embedded',
          name: id,
          fileName: `${id}.bin`,
          mediaType: 'application/octet-stream',
          byteLength: bytes.byteLength,
          contentHash,
        },
      },
    }),
    write: { resourceId: id, contentHash, bytes: new Uint8Array(bytes) },
  }
}
