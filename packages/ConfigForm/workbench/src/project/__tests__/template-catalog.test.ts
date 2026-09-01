import type { RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { ProjectTemplateCatalogEntry, TemplateCatalogProvider, TemplateIdentityFactory } from '../templates'
import { describe, expect, it } from 'vitest'
import {
  analyzeTemplateCompatibility,
  builtInTemplateCatalogProvider,
  createTemplateCatalogService,
  filterTemplateCatalog,
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

function deterministicFactory(namespace: string): TemplateIdentityFactory {
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
    schemaVersion: 1,
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

  it('rejects nested manifest extensions and unsupported typed identity references at the catalog boundary', async () => {
    const source = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const extended = structuredClone({ manifest: source.manifest, page: source.page })
    Object.assign(extended.manifest.preview, { executable: 'not-part-of-the-contract' })
    expect(parseProjectTemplateSeed(extended, 'test')).toMatchObject({
      code: 'TEMPLATE_INVALID',
      path: 'manifest.preview',
    })

    const unsupported = structuredClone({ manifest: source.manifest, page: source.page })
    unsupported.page.flows = [{
      version: 1,
      id: 'unsupported-condition-config',
      name: 'Unsupported condition config',
      trigger: { kind: 'page.mount' },
      nodes: [
        { id: 'trigger', type: 'trigger' },
        { id: 'condition', type: 'condition', config: {} },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'start', source: 'trigger', target: 'condition', condition: 'next' },
        { id: 'true-end', source: 'condition', target: 'end', condition: 'true' },
        { id: 'false-end', source: 'condition', target: 'end', condition: 'false' },
      ],
    }]
    expect(parseProjectTemplateSeed(unsupported, 'test')).toMatchObject({
      code: 'TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED',
      path: 'page',
    })
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

  it('explains adapter, Registry lock, and missing component incompatibility', async () => {
    const template = (await builtIns()).find(item => item.manifest.id === 'element-profile')!
    const registry = registrySnapshot(template)
    expect(analyzeTemplateCompatibility(template, { registry, target: 'project' })).toEqual({ compatible: true, diagnostics: [] })
    const incompatible = analyzeTemplateCompatibility(template, {
      registry,
      target: 'page',
      targetLock: createRegistryLockFixture('antd-vue'),
    })
    expect(incompatible.compatible).toBe(false)
    expect(incompatible.diagnostics.map(item => item.code)).toContain('TEMPLATE_REGISTRY_ADAPTER_MISMATCH')

    const missing = analyzeTemplateCompatibility(template, {
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

  it('remaps typed condition, reaction, and Flow references while preserving opaque action config', async () => {
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
    template.page.flows = [{
      version: 1,
      id: 'role-change',
      name: 'Role change',
      trigger: { kind: 'field.change', field: 'role' },
      nodes: [
        { id: 'trigger', type: 'trigger' },
        {
          id: 'condition',
          type: 'condition',
          config: {
            condition: {
              kind: 'compare',
              operator: 'eq',
              left: { kind: 'field', field: 'role' },
              right: { kind: 'literal', value: 'developer' },
            },
          },
        },
        { id: 'work', type: 'action', ref: 'notify', config: { input: { identityLikeText: 'profile-name' } } },
        {
          id: 'reaction',
          type: 'reaction',
          config: {
            reactions: [{
              id: 'flow-reaction',
              when: { kind: 'literal', value: true },
              then: [{ kind: 'setProps', target: 'name', props: { placeholder: { kind: 'field', field: 'role' } } }],
            }],
          },
        },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'trigger-condition', source: 'trigger', target: 'condition', condition: 'next' },
        { id: 'condition-work', source: 'condition', target: 'work', condition: 'true' },
        { id: 'condition-end', source: 'condition', target: 'end', condition: 'false' },
        { id: 'work-reaction', source: 'work', target: 'reaction', condition: 'next' },
        { id: 'reaction-end', source: 'reaction', target: 'end', condition: 'next' },
      ],
    }]
    template.page.flows.push({
      ...structuredClone(template.page.flows[0]!),
      id: 'secondary-role-change',
      name: 'Secondary role change',
      trigger: { kind: 'component.event', nodeId: 'profile-name', event: 'change' },
    })
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
    const [flow, secondaryFlow] = remapped.flows!
    expect(fields).toContain(flow!.trigger.field)
    const mappedName = Object.values(remapped.graph.nodesById).find(node => node.kind === 'field' && node.label === 'Name')
    const mappedRole = Object.values(remapped.graph.nodesById).find(node => node.kind === 'field' && node.label === 'Role')
    if (mappedName?.kind !== 'field' || mappedRole?.kind !== 'field')
      throw new TypeError('Remapped profile fields are missing.')
    expect(mappedName.validation?.rules[0]).toMatchObject({ kind: 'compare', field: mappedRole.field })
    expect(secondaryFlow!.trigger.nodeId).toBe(mappedName.id)
    expect((flow!.nodes.find(node => node.type === 'condition')?.config as {
      condition: { left: { field: string } }
    }).condition.left.field).toBe(mappedRole.field)
    expect(flow!.nodes.find(node => node.type === 'action')?.config).toEqual({ input: { identityLikeText: 'profile-name' } })
    const flowNodeIds = new Set(flow!.nodes.map(node => node.id))
    const secondaryNodeIds = new Set(secondaryFlow!.nodes.map(node => node.id))
    const flowEdgeIds = new Set(flow!.edges.map(edge => edge.id))
    const secondaryEdgeIds = new Set(secondaryFlow!.edges.map(edge => edge.id))
    expect([...flowNodeIds].some(id => secondaryNodeIds.has(id))).toBe(false)
    expect([...flowEdgeIds].some(id => secondaryEdgeIds.has(id))).toBe(false)
    for (const currentFlow of [flow!, secondaryFlow!]) {
      const nodeIds = new Set(currentFlow.nodes.map(node => node.id))
      expect(currentFlow.edges.every(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true)
    }
    const reactionIds = [flow!, secondaryFlow!].map(currentFlow =>
      (currentFlow.nodes.find(node => node.type === 'reaction')?.config as { reactions: Array<{ id: string }> }).reactions[0]!.id)
    expect(new Set(reactionIds).size).toBe(2)
    expect(role.field).toBe('role')
  })
})
