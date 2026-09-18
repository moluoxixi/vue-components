import type { RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { ProjectIdentityFactory } from '..'
import type { ProjectTemplateCatalogEntry, TemplateCatalogProvider } from '../templates'
import {
  REGISTRY_CONTRACT_SNAPSHOT_VERSION,
  registryLockFingerprint,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  analyzeTemplateEligibility,
  builtInTemplateCatalogProvider,
  createTemplateCatalogService,
  filterTemplateCatalog,
  getProjectTemplateSeedFingerprint,
  instantiateTemplatePage,
  instantiateTemplateProject,
  parseProjectTemplateSeed,
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
    expect(templates.filter(template => template.manifest.category === 'blank').every(template => Object.keys(template.page.graph.nodesById).length === 0)).toBe(true)
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

    const unsafe = JSON.parse('{"manifest":{"id":"unsafe"},"page":{"__proto__":{"polluted":true}}}')
    expect(parseProjectTemplateSeed(unsafe, 'test')).toMatchObject({ code: 'TEMPLATE_UNSAFE_KEY' })
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('rejects nested manifest extensions and removed event-domain fields at the catalog boundary', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const extended = structuredClone({ manifest: source.manifest, page: source.page })
    Object.assign(extended.manifest.preview, { executable: 'not-part-of-the-contract' })
    expect(parseProjectTemplateSeed(extended, 'test')).toMatchObject({
      code: 'TEMPLATE_INVALID',
      path: 'manifest.preview',
    })

    const unsupported = structuredClone({ manifest: source.manifest, page: source.page }) as unknown as {
      manifest: typeof source.manifest
      page: Record<string, unknown>
    }
    unsupported.page.flows = []
    expect(parseProjectTemplateSeed(unsupported, 'test')).toMatchObject({
      code: 'TEMPLATE_SEED_INVALID',
      path: `pagesById.${source.page.id}`,
    })
  })

  it('accepts only the current manifest version and fingerprints seed content', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    for (const version of [undefined, 0, 2]) {
      const input = structuredClone({ manifest: source.manifest, page: source.page }) as unknown as {
        manifest: Record<string, unknown>
        page: ProjectTemplateCatalogEntry['page']
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
    changed.page.name = 'Changed seed'
    expect(getProjectTemplateSeedFingerprint(changed)).not.toBe(first)
  })

  it('fails closed on oversized arrays and invalid manifest order', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const maximumProvider = {
      id: 'maximum',
      list: async () => Array.from({ length: 256 }, (_, index) => {
        const seed = structuredClone({ manifest: source.manifest, page: source.page })
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

    const maximumSeed = structuredClone({ manifest: source.manifest, page: source.page })
    maximumSeed.manifest.tags = Array.from({ length: 4096 }, (_, index) => `tag-${index}`)
    expect(parseProjectTemplateSeed(maximumSeed, 'test')).not.toHaveProperty('code')

    const oversizedSeed = structuredClone({ manifest: source.manifest, page: source.page })
    oversizedSeed.manifest.tags = Array.from({ length: 4097 }, (_, index) => `tag-${index}`)
    oversizedSeed.manifest.tags[0] = undefined as unknown as string
    expect(parseProjectTemplateSeed(oversizedSeed, 'test')).toMatchObject({
      code: 'TEMPLATE_INVALID',
      path: '$.manifest.tags',
    })

    for (const order of [-1, 1.5]) {
      const invalidOrder = structuredClone({ manifest: source.manifest, page: source.page })
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
      target: 'page',
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

  it('creates isolated project, page, node, and field identities from one immutable seed', async () => {
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
    const firstPage = first.pagesById[first.homePageId]!
    const secondPage = second.pagesById[second.homePageId]!
    expect(first.id).not.toBe(second.id)
    expect(firstPage.id).not.toBe(secondPage.id)
    expect(Object.keys(firstPage.graph.nodesById)).not.toEqual(Object.keys(secondPage.graph.nodesById))
    expect(Object.values(firstPage.graph.nodesById).map(node => node.kind === 'field' ? node.field : '')).not.toEqual(
      Object.values(secondPage.graph.nodesById).map(node => node.kind === 'field' ? node.field : ''),
    )
    firstPage.name = 'Changed'
    expect(secondPage.name).toBe('Second')
    expect(JSON.stringify(template)).toBe(seedJson)
  })

  it('keeps the complete current Registry lock on instantiated projects', async () => {
    const template = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const registryLock = createRegistryLockFixture('element-plus')
    registryLock.components['element.input-number'] = {
      contractVersion: '1',
      fingerprint: 'fnv1a:element-input-number',
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
    const page = project.pagesById[project.homePageId]!

    expect(project.id).toMatch(/^element-profile-/)
    expect(page.id).toMatch(new RegExp(`^${template.page.id}-`))
    expect(Object.keys(page.graph.nodesById)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^profile-name-/),
      expect.stringMatching(/^profile-role-/),
      expect.stringMatching(/^profile-active-/),
    ]))
    expect(Object.values(page.graph.nodesById)
      .filter(node => node.kind === 'field')
      .map(node => node.field)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^name-/),
      expect.stringMatching(/^role-/),
      expect.stringMatching(/^active-/),
    ]))
  })

  it('remaps typed condition and reaction references without adding event metadata', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const template = structuredClone(source)
    const name = template.page.graph.nodesById['profile-name']!
    const role = template.page.graph.nodesById['profile-role']!
    if (name.kind !== 'field' || role.kind !== 'field')
      throw new TypeError('Profile template field fixture is invalid.')
    name.conditions = {
      visible: {
        kind: 'compare',
        operator: 'eq',
        left: { kind: 'field', field: 'role' },
        right: { kind: 'literal', value: 'developer' },
      },
    }
    name.reactions = [{
      id: 'sync-name',
      when: { kind: 'literal', value: true },
      then: [{ kind: 'setValue', target: 'role', value: { kind: 'field', field: 'name' } }],
    }]
    name.validation = {
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'compare', field: 'role', operator: 'neq' }],
    }
    const remapped = instantiateTemplatePage(template, {
      id: 'new-page',
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
    expect(mappedName.conditions?.visible).toMatchObject({
      kind: 'compare',
      left: { field: mappedRole.field },
    })
    expect(mappedName.reactions?.[0]?.id).not.toBe('sync-name')
    expect(mappedName.reactions?.[0]?.then[0]).toMatchObject({
      kind: 'setValue',
      target: mappedRole.field,
      value: { kind: 'field', field: mappedName.field },
    })
    expect(role.field).toBe('role')
  })
})
