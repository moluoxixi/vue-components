import type { ProjectSurface, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { ProjectIdentityFactory } from '..'
import type { ProjectTemplateCatalogEntry, TemplateCatalogProvider } from '../templates'
import {
  REGISTRY_CONTRACT_SNAPSHOT_VERSION,
  registryLockFingerprint,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  analyzeTemplateEligibility,
  builtInTemplateCatalogProvider,
  createTemplateCatalogService,
  filterTemplateCatalog,
  getProjectTemplateSeedFingerprint,
  instantiateTemplateProject,
  instantiateTemplateSurface,
  parseProjectTemplateSeed,
  prepareTemplatePreview,
} from '../templates'
import { createRegistryLockFixture } from './fixtures'

async function builtIns(): Promise<ProjectTemplateCatalogEntry[]> {
  const result = await createTemplateCatalogService([builtInTemplateCatalogProvider]).load()
  expect(result.diagnostics).toEqual([])
  return result.templates
}

function deterministicFactory(namespace: string): ProjectIdentityFactory {
  let sequence = 0
  return {
    create(kind, source) {
      return `${namespace}-${kind}-${source}-${++sequence}`
    },
  }
}

function registrySnapshot(entry: ProjectTemplateCatalogEntry): RegistryContractSnapshot {
  const lock = createRegistryLockFixture(entry.manifest.adapter)
  return {
    version: REGISTRY_CONTRACT_SNAPSHOT_VERSION,
    adapter: lock.adapter,
    adapterVersion: lock.version,
    fingerprint: lock.fingerprint,
    components: entry.manifest.registry.components.map(requirement => ({
      key: requirement.key,
      contractVersion: lock.components[requirement.key]?.contractVersion ?? '1',
      fingerprint: lock.components[requirement.key]?.fingerprint ?? `fp:${requirement.key}`,
      contract: {} as never,
    })),
  }
}

describe('template catalog', () => {
  it('loads four stable JSON-safe built-ins through a data-only provider', async () => {
    const templates = await builtIns()
    expect(templates.map(template => template.manifest.id)).toEqual([
      'element-blank',
      'element-profile',
      'antd-blank',
      'antd-profile',
    ])
    expect(templates.map(template => template.manifest.category)).toEqual(['blank', 'starter', 'blank', 'starter'])
    expect(JSON.parse(JSON.stringify(await builtInTemplateCatalogProvider.list()))).toHaveLength(4)
    expect(templates.filter(template => template.manifest.category === 'blank').every(template => Object.keys(template.surface.graph.nodesById).length === 0)).toBe(true)
  })

  it('filters display metadata, tags, category, and provider without mutating entries', async () => {
    const templates = await builtIns()
    expect(filterTemplateCatalog(templates, { query: 'Ant Design Vue profile' }).map(item => item.manifest.id)).toEqual(['antd-profile'])
    expect(filterTemplateCatalog(templates, { category: 'blank' }).map(item => item.manifest.id)).toEqual(['element-blank', 'antd-blank'])
    expect(filterTemplateCatalog(templates, { providerId: 'missing' })).toEqual([])
    const filtered = filterTemplateCatalog(templates, { query: 'profile' })
    filtered[0]!.manifest.tags.push('mutated')
    expect(templates[1]!.manifest.tags).not.toContain('mutated')
  })

  it('isolates provider failures and diagnoses duplicates and unsafe data', async () => {
    const duplicateProvider = { id: 'built-in', list: async () => [] }
    const failedProvider = { id: 'failed', list: async () => Promise.reject(new Error('offline')) }
    const malformedProvider = {
      id: 'malformed',
      list: async () => ({ templates: [] }),
    } as unknown as TemplateCatalogProvider
    const result = await createTemplateCatalogService([
      builtInTemplateCatalogProvider,
      duplicateProvider,
      failedProvider,
      malformedProvider,
    ]).load()
    expect(result.templates).toHaveLength(4)
    expect(result.diagnostics.map(item => item.code)).toEqual(expect.arrayContaining([
      'TEMPLATE_PROVIDER_DUPLICATE',
      'TEMPLATE_PROVIDER_FAILED',
    ]))
    expect(result.diagnostics.find(item => item.providerId === 'malformed')).toMatchObject({
      code: 'TEMPLATE_PROVIDER_FAILED',
      message: expect.stringContaining('must resolve to an array'),
    })

    const unsafe = JSON.parse('{"manifest":{"id":"unsafe"},"surface":{"__proto__":{"polluted":true}}}')
    expect(parseProjectTemplateSeed(unsafe, 'test')).toMatchObject({ code: 'TEMPLATE_UNSAFE_KEY' })
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('rejects nested manifest extensions and removed event-domain fields at the catalog boundary', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const extended = structuredClone({ manifest: source.manifest, surface: source.surface })
    Object.assign(extended.manifest.preview, { executable: 'not-part-of-the-contract' })
    expect(parseProjectTemplateSeed(extended, 'test')).toMatchObject({
      code: 'TEMPLATE_INVALID',
      path: 'manifest.preview',
    })

    const unsupported = structuredClone({ manifest: source.manifest, surface: source.surface }) as unknown as {
      manifest: typeof source.manifest
      surface: Record<string, unknown>
    }
    unsupported.surface.flows = []
    expect(parseProjectTemplateSeed(unsupported, 'test')).toMatchObject({
      code: 'TEMPLATE_SEED_INVALID',
      path: 'surface',
    })
  })

  it('parses and remaps Dialog and Drawer Surface templates without fabricating a Page project', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-blank')!
    const adapter = await loadWorkbenchAdapter('element-plus')
    const shared = {
      graph: structuredClone(source.surface.graph),
      interactions: [],
      name: 'Overlay seed',
      outputs: [],
      parameters: [],
    }
    const overlays: ProjectSurface[] = [{
      ...shared,
      id: 'dialog-seed',
      kind: 'dialog',
      presentation: {
        kind: 'dialog',
        title: 'Dialog seed',
        width: { desktop: { value: 480, unit: 'px' } },
        mask: true,
        close: { escape: true, mask: true, button: true },
      },
    }, {
      ...shared,
      id: 'drawer-seed',
      kind: 'drawer',
      presentation: {
        kind: 'drawer',
        title: 'Drawer seed',
        placement: 'right',
        size: { desktop: { value: 40, unit: '%' } },
        mask: true,
        close: { escape: true, mask: true, button: true },
      },
    }]

    for (const overlay of overlays) {
      const parsed = parseProjectTemplateSeed({
        manifest: {
          ...structuredClone(source.manifest),
          id: `element-${overlay.kind}-overlay`,
          preview: {
            ...structuredClone(source.manifest.preview),
            surfaceId: overlay.id,
          },
        },
        surface: overlay,
      }, 'test')
      expect(parsed).not.toHaveProperty('code')
      if ('code' in parsed)
        continue
      const template = { providerId: 'test', ...parsed }
      const instantiated = instantiateTemplateSurface(template, {
        id: `created-${overlay.kind}`,
        identityFactory: deterministicFactory(overlay.kind),
        name: `Created ${overlay.kind}`,
      })
      expect(instantiated).toMatchObject({
        id: `created-${overlay.kind}`,
        kind: overlay.kind,
        name: `Created ${overlay.kind}`,
      })
      expect(analyzeTemplateEligibility(template, {
        registry: adapter.registrySnapshot,
        target: 'surface',
      })).toEqual({ eligible: true, diagnostics: [] })
      expect(analyzeTemplateEligibility(template, {
        registry: adapter.registrySnapshot,
        target: 'project',
      })).toMatchObject({
        eligible: false,
        diagnostics: [{ code: 'TEMPLATE_TARGET_KIND_INVALID' }],
      })
      expect(() => instantiateTemplateProject(template, {
        name: `Invalid ${overlay.kind} project`,
        registryLock: adapter.componentRegistry.lock,
      })).toThrow('TEMPLATE_TARGET_KIND_INVALID')
      expect(() => prepareTemplatePreview(template, adapter)).toThrow('TEMPLATE_TARGET_KIND_INVALID')
    }
  })

  it('remaps a template self-reference and rejects external Surface targets', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const selfReferencing = structuredClone(source)
    const nodeId = selfReferencing.surface.graph.root[0]!.nodeId
    selfReferencing.surface.interactions = [{
      kind: 'primaryUiAction',
      id: 'navigate-self',
      nodeId,
      trigger: 'activate',
      action: {
        kind: 'navigate',
        targetSurfaceId: selfReferencing.surface.id,
        parameters: [],
      },
    }]
    const parsed = parseProjectTemplateSeed({
      manifest: selfReferencing.manifest,
      surface: selfReferencing.surface,
    }, 'test')
    expect(parsed).not.toHaveProperty('code')
    if ('code' in parsed)
      return
    const instantiated = instantiateTemplateSurface({ providerId: 'test', ...parsed }, {
      id: 'self-remapped',
      identityFactory: deterministicFactory('self'),
      name: 'Self remapped',
      route: '/self-remapped',
    })
    expect(instantiated.interactions[0]).toMatchObject({
      kind: 'primaryUiAction',
      action: { kind: 'navigate', targetSurfaceId: 'self-remapped' },
    })

    const external = structuredClone(selfReferencing)
    const action = external.surface.interactions[0]
    if (!action || action.kind !== 'primaryUiAction' || action.action.kind !== 'navigate')
      throw new TypeError('Template Surface reference fixture is invalid.')
    action.action.targetSurfaceId = 'external-surface'
    expect(parseProjectTemplateSeed({
      manifest: external.manifest,
      surface: external.surface,
    }, 'test')).toMatchObject({
      code: 'TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED',
      path: 'surface',
    })
  })

  it.each(['dataset', 'resource'] as const)(
    'rejects standalone template %s references without an asset mapping',
    async (kind) => {
      const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
      const seed = structuredClone(source)
      const node = seed.surface.graph.nodesById['profile-role']!
      if (kind === 'dataset') {
        node.datasetBindings = {
          options: {
            datasetId: 'external-dataset',
            projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
          },
        }
      }
      else {
        node.resourceBindings = { media: { resourceId: 'external-resource' } }
      }
      expect(parseProjectTemplateSeed({
        manifest: seed.manifest,
        surface: seed.surface,
      }, 'test')).toMatchObject({
        code: 'TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED',
        path: 'surface',
      })
    },
  )

  it('accepts only the current manifest version and fingerprints seed content', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    for (const version of [undefined, 0, 2]) {
      const input = structuredClone({ manifest: source.manifest, surface: source.surface }) as unknown as {
        manifest: Record<string, unknown>
        surface: ProjectTemplateCatalogEntry['surface']
      }
      if (version === undefined)
        delete input.manifest.version
      else
        input.manifest.version = version
      expect(parseProjectTemplateSeed(input, 'test')).toMatchObject({
        code: 'TEMPLATE_VERSION_INVALID',
        path: 'manifest.version',
      })
    }

    const first = getProjectTemplateSeedFingerprint(source)
    expect(getProjectTemplateSeedFingerprint(structuredClone(source))).toBe(first)
    const changed = structuredClone(source)
    changed.surface.name = 'Changed seed'
    expect(getProjectTemplateSeedFingerprint(changed)).not.toBe(first)
  })

  it('fails closed on oversized arrays and invalid manifest order', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const maximumProvider = {
      id: 'maximum',
      list: async () => Array.from({ length: 256 }, (_, index) => {
        const seed = structuredClone({ manifest: source.manifest, surface: source.surface })
        seed.manifest.id = `maximum-${index}`
        seed.manifest.order = index
        return seed
      }),
    }
    const maximumProviderResult = await createTemplateCatalogService([maximumProvider]).load()
    expect(maximumProviderResult.templates).toHaveLength(256)
    expect(maximumProviderResult.diagnostics).toEqual([])

    const oversizedProvider = {
      id: 'oversized',
      list: async () => Array.from({ length: 257 }).fill(source),
    }
    const providerResult = await createTemplateCatalogService([oversizedProvider]).load()
    expect(providerResult).toMatchObject({ templates: [] })
    expect(providerResult.diagnostics[0]).toMatchObject({
      code: 'TEMPLATE_PROVIDER_FAILED',
      message: expect.stringContaining('256-template limit'),
    })

    const maximumSeed = structuredClone({ manifest: source.manifest, surface: source.surface })
    maximumSeed.manifest.tags = Array.from({ length: 4096 }, (_, index) => `tag-${index}`)
    expect(parseProjectTemplateSeed(maximumSeed, 'test')).not.toHaveProperty('code')

    const oversizedSeed = structuredClone({ manifest: source.manifest, surface: source.surface })
    oversizedSeed.manifest.tags = Array.from({ length: 4097 }, (_, index) => `tag-${index}`)
    oversizedSeed.manifest.tags[0] = undefined as unknown as string
    expect(parseProjectTemplateSeed(oversizedSeed, 'test')).toMatchObject({
      code: 'TEMPLATE_INVALID',
      path: '$.manifest.tags',
    })

    for (const order of [-1, 1.5]) {
      const invalidOrder = structuredClone({ manifest: source.manifest, surface: source.surface })
      invalidOrder.manifest.order = order
      expect(parseProjectTemplateSeed(invalidOrder, 'test')).toMatchObject({
        code: 'TEMPLATE_INVALID',
        path: 'manifest',
      })
    }
  })

  it('explains unmet adapter, Registry lock, and component requirements', async () => {
    const template = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const registry = registrySnapshot(template)
    expect(analyzeTemplateEligibility(template, { registry, target: 'project' })).toEqual({ eligible: true, diagnostics: [] })
    const ineligible = analyzeTemplateEligibility(template, {
      registry,
      target: 'surface',
      targetLock: createRegistryLockFixture('antd-vue'),
    })
    expect(ineligible.eligible).toBe(false)
    expect(ineligible.diagnostics.map(item => item.code)).toContain('TEMPLATE_REGISTRY_ADAPTER_MISMATCH')

    const missing = analyzeTemplateEligibility(template, {
      registry: { ...registry, components: registry.components.slice(1) },
      target: 'project',
    })
    expect(missing.diagnostics[0]).toMatchObject({ code: 'TEMPLATE_REGISTRY_COMPONENT_MISSING' })
  })

  it('creates isolated project, Surface, node, and field identities from one immutable seed', async () => {
    const template = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const seedJson = JSON.stringify(template)
    const first = instantiateTemplateProject(template, {
      identityFactory: deterministicFactory('first'),
      name: 'First',
      registryLock: createRegistryLockFixture('element-plus'),
    })
    const second = instantiateTemplateProject(template, {
      identityFactory: deterministicFactory('second'),
      name: 'Second',
      registryLock: createRegistryLockFixture('element-plus'),
    })
    const firstSurface = first.surfacesById[first.homeSurfaceId]!
    const secondSurface = second.surfacesById[second.homeSurfaceId]!
    expect(first.id).not.toBe(second.id)
    expect(firstSurface.id).not.toBe(secondSurface.id)
    expect(Object.keys(firstSurface.graph.nodesById)).not.toEqual(Object.keys(secondSurface.graph.nodesById))
    expect(Object.values(firstSurface.graph.nodesById).map(node => node.kind === 'field' ? node.field : '')).not.toEqual(
      Object.values(secondSurface.graph.nodesById).map(node => node.kind === 'field' ? node.field : ''),
    )
    firstSurface.name = 'Changed'
    expect(secondSurface.name).toBe('Second')
    expect(JSON.stringify(template)).toBe(seedJson)
  })

  it('keeps the complete current Registry lock on instantiated projects', async () => {
    const template = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const registryLock = createRegistryLockFixture('element-plus')
    registryLock.components['element.input-number'] = {
      contractVersion: '1',
      fingerprint: 'fnv1a:00000004',
    }
    registryLock.fingerprint = registryLockFingerprint(registryLock.components)

    const project = instantiateTemplateProject(template, {
      identityFactory: deterministicFactory('registry-current'),
      name: 'Current Registry',
      registryLock,
    })

    expect(project.registryLock).toEqual(registryLock)
    expect(project.registryLock).not.toBe(registryLock)
    expect(project.registryLock.components).toHaveProperty('element.input-number')
  })

  it('keeps readable source prefixes in default generated identities', async () => {
    const template = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const project = instantiateTemplateProject(template, {
      name: 'Readable identities',
      registryLock: createRegistryLockFixture('element-plus'),
    })
    const surface = project.surfacesById[project.homeSurfaceId]!

    expect(project.id).toMatch(/^element-profile-/)
    expect(surface.id).toMatch(new RegExp(`^${template.surface.id}-`))
    expect(Object.keys(surface.graph.nodesById)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^profile-name-/),
      expect.stringMatching(/^profile-role-/),
      expect.stringMatching(/^profile-active-/),
    ]))
    expect(Object.values(surface.graph.nodesById)
      .filter(node => node.kind === 'field')
      .map(node => node.field)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^name-/),
      expect.stringMatching(/^role-/),
      expect.stringMatching(/^active-/),
    ]))
  })

  it('remaps validation and Prototype Interaction references without adding event metadata', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const template = structuredClone(source)
    const name = template.surface.graph.nodesById['profile-name']!
    const role = template.surface.graph.nodesById['profile-role']!
    if (name.kind !== 'field' || role.kind !== 'field')
      throw new TypeError('Profile template field fixture is invalid.')
    template.surface.interactions = [
      {
        kind: 'stateProjection',
        id: 'show-name',
        target: { kind: 'state', nodeId: name.id, key: 'visible' },
        value: { version: 1, ast: { kind: 'literal', value: true } },
      },
      {
        kind: 'valueChange',
        id: 'sync-name',
        dependencies: [name.id],
        action: { kind: 'copy', sourceFieldId: name.id, targetFieldId: role.id },
      },
    ]
    name.validation = {
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'compare', field: 'role', operator: 'neq' }],
    }
    const remapped = instantiateTemplateSurface(template, {
      id: 'new-surface',
      identityFactory: deterministicFactory('mapped'),
      name: 'Mapped',
      route: '/mapped',
    })
    const fields = Object.values(remapped.graph.nodesById)
      .filter(node => node.kind === 'field')
      .map(node => node.field)
    expect(fields).not.toContain('name')
    expect(fields).not.toContain('role')
    expect(JSON.stringify(remapped)).not.toContain('"nodeId":"profile-name"')
    expect(remapped).not.toHaveProperty('events')
    expect(remapped).not.toHaveProperty('flows')
    const mappedName = Object.values(remapped.graph.nodesById).find(node => node.kind === 'field' && node.label === 'Name')
    const mappedRole = Object.values(remapped.graph.nodesById).find(node => node.kind === 'field' && node.label === 'Role')
    if (mappedName?.kind !== 'field' || mappedRole?.kind !== 'field')
      throw new TypeError('Remapped profile fields are missing.')
    expect(mappedName.validation?.rules[0]).toMatchObject({ kind: 'compare', field: mappedRole.field })
    expect(remapped.interactions[0]).toMatchObject({
      kind: 'stateProjection',
      target: { nodeId: mappedName.id },
    })
    expect(remapped.interactions[0]?.id).not.toBe('show-name')
    expect(remapped.interactions[1]).toMatchObject({
      kind: 'valueChange',
      dependencies: [mappedName.id],
      action: {
        kind: 'copy',
        sourceFieldId: mappedName.id,
        targetFieldId: mappedRole.id,
      },
    })
    expect(remapped.interactions[1]?.id).not.toBe('sync-name')
    expect(role.field).toBe('role')
  })
})
