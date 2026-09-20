import type {
  ComponentContract,
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ProjectPageSurface,
  ProjectRepositoryCommitInput,
  ProjectSurface,
  RegistryLock,
  SurfaceFieldNode,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectTransaction,
  assertRegistryContractSnapshot,
  collectSurfaceDependencyClosure,
  componentContractFingerprint,
  createComponentContractRegistry,
  createMemoryProjectRepository,
  createProjectDomainEngine,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  parseProjectDocument,
  parseRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  readProjectTransfer,
  readSurfaceTransfer,
  REGISTRY_CONTRACT_SNAPSHOT_VERSION,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
  writeProjectTransfer,
  writeSurfaceTransfer,
} from '../index'

const REGISTRY_COMPONENTS: RegistryLock['components'] = {
  'element.input': { contractVersion: '1', fingerprint: 'fnv1a:12345678' },
}

const REGISTRY_LOCK: RegistryLock = {
  adapter: 'element-plus',
  version: '1.0.0',
  fingerprint: registryLockFingerprint(REGISTRY_COMPONENTS),
  components: REGISTRY_COMPONENTS,
}

function fieldNode(
  id = 'name',
  field = id,
  overrides: Partial<SurfaceFieldNode> = {},
): SurfaceFieldNode {
  return {
    id,
    component: 'element.input',
    kind: 'field',
    field,
    props: {},
    ...overrides,
  }
}

function pageSurface(
  id = 'home',
  route = '/',
  node: SurfaceFieldNode | undefined = fieldNode(),
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
      root: node ? [{ nodeId: node.id, placement: {} }] : [],
      nodesById: node ? { [node.id]: node } : {},
    },
  }
}

function documentFixture(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  const home = pageSurface()
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: { home },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: structuredClone(REGISTRY_LOCK),
    settings: {},
    ...overrides,
  }
}

function dialogSurface(id = 'dialog'): ProjectSurface {
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

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

async function resourceDocument(bytes = new Uint8Array([1, 2, 3])): Promise<{
  document: ProjectDocument
  write: ProjectEmbeddedResourceWrite
}> {
  const contentHash = await sha256(bytes)
  const document = documentFixture({
    resources: {
      logo: {
        id: 'logo',
        kind: 'embedded',
        name: 'Logo',
        fileName: 'logo.png',
        mediaType: 'image/png',
        byteLength: bytes.byteLength,
        contentHash,
      },
    },
  })
  return { document, write: { resourceId: 'logo', contentHash, bytes: new Uint8Array(bytes) } }
}

describe('projectDocument v7 and SurfaceGraph v2', () => {
  it('accepts the strict Surface shape and rejects Page-only/removed fields', () => {
    const parsed = parseProjectDocument(documentFixture())
    expect(parsed.success).toBe(true)

    const legacy = parseProjectDocument({
      ...documentFixture(),
      version: PROJECT_DOCUMENT_VERSION - 1,
      homePageId: 'home',
      pageOrder: ['home'],
      pagesById: { home: pageSurface() },
    })
    expect(legacy).toMatchObject({ success: false, diagnostics: [{ code: 'unsupported_contract_version' }] })

    const removed = structuredClone(documentFixture()) as unknown as Record<string, unknown>
    const surface = (removed.surfacesById as Record<string, Record<string, unknown>>).home
    const graph = surface.graph as Record<string, unknown>
    graph.bindings = {}
    expect(parseProjectDocument(removed)).toMatchObject({ success: false })
  })

  it('round-trips field-level required and rejects stale or mixed validation contracts', () => {
    const current = documentFixture({
      surfacesById: {
        home: pageSurface('home', '/', fieldNode('name', 'name', {
          defaultValue: '',
          required: true,
          requiredMessage: '请输入姓名',
          validation: {
            version: 2,
            base: { type: 'string' },
            rules: [{ kind: 'minLength', value: 2 }],
          },
        })),
      },
    })
    const parsed = parseProjectDocument(JSON.parse(JSON.stringify(current)))
    expect(parsed).toMatchObject({
      success: true,
      data: {
        surfacesById: {
          home: {
            graph: {
              nodesById: {
                name: {
                  required: true,
                  requiredMessage: '请输入姓名',
                  validation: { version: 2 },
                },
              },
            },
          },
        },
      },
    })

    for (const version of [PROJECT_DOCUMENT_VERSION - 1, PROJECT_DOCUMENT_VERSION + 1, undefined]) {
      const candidate = structuredClone(current) as unknown as Record<string, unknown>
      if (version === undefined)
        delete candidate.version
      else
        candidate.version = version
      expect(parseProjectDocument(candidate)).toMatchObject({
        success: false,
        diagnostics: [{ code: 'unsupported_contract_version' }],
      })
    }

    for (const version of [SURFACE_GRAPH_VERSION - 1, SURFACE_GRAPH_VERSION + 1, undefined]) {
      const candidate = structuredClone(current) as unknown as {
        surfacesById: Record<string, { graph: Record<string, unknown> }>
      }
      if (version === undefined)
        delete candidate.surfacesById.home!.graph.version
      else
        candidate.surfacesById.home!.graph.version = version
      expect(parseProjectDocument(candidate).success).toBe(false)
    }

    for (const validation of [
      { version: 1, base: { type: 'string' }, rules: [] },
      { version: 3, base: { type: 'string' }, rules: [] },
      { version: 2, base: { type: 'string' }, rules: [{ kind: 'required' }] },
    ]) {
      const candidate = structuredClone(current) as unknown as {
        surfacesById: Record<string, { graph: { nodesById: Record<string, Record<string, unknown>> } }>
      }
      candidate.surfacesById.home!.graph.nodesById.name!.validation = validation
      expect(parseProjectDocument(candidate).success).toBe(false)
    }
  })

  it('enforces home kind, route uniqueness, and order/map bijection', () => {
    const dialog = dialogSurface()
    expect(parseProjectDocument(documentFixture({
      homeSurfaceId: 'dialog',
      surfaceOrder: ['home', 'dialog'],
      surfacesById: { home: pageSurface(), dialog },
    })).success).toBe(false)
    expect(parseProjectDocument(documentFixture({
      surfaceOrder: ['home', 'other'],
      surfacesById: { home: pageSurface(), other: pageSurface('other', '/') },
    })).success).toBe(false)
    expect(parseProjectDocument(documentFixture({
      surfaceOrder: ['home', 'missing'],
    })).success).toBe(false)
  })

  it('rejects non-canonical identities and Registry lock fingerprints instead of normalizing them', () => {
    expect(parseProjectDocument(documentFixture({ id: ' project ' })).success).toBe(false)
    expect(parseProjectDocument(documentFixture({ homeSurfaceId: ' home ' })).success).toBe(false)
    expect(parseProjectDocument(documentFixture({
      registryLock: { ...structuredClone(REGISTRY_LOCK), fingerprint: 'fnv1a:00000000' },
    })).success).toBe(false)
    expect(parseProjectDocument(documentFixture({
      surfacesById: {
        home: pageSurface('home', '/', fieldNode('name', 'name', { component: 'element.missing' })),
      },
    }))).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'surface_graph_invalid',
        surfaceId: 'home',
        nodeId: 'name',
        context: { component: 'element.missing' },
      }],
    })
  })

  it('parses every Safe Expression reference variant without throwing', () => {
    const expressionDocument = documentFixture({
      surfacesById: {
        home: {
          ...pageSurface(),
          parameters: [{ name: 'fallback', required: false, defaultValue: 'fallback' }],
          interactions: [{
            kind: 'stateProjection',
            id: 'show-name',
            target: { kind: 'state', nodeId: 'name', key: 'visible' },
            value: {
              version: 1,
              ast: {
                kind: 'call',
                callee: 'coalesce',
                args: [
                  { kind: 'reference', scope: 'values', selector: 'root', path: ['name'] },
                  { kind: 'reference', scope: 'parameters', path: ['fallback'] },
                  { kind: 'literal', value: true },
                ],
              },
            },
          }],
        },
      },
    })
    expect(() => parseProjectDocument(expressionDocument)).not.toThrow()
    expect(parseProjectDocument(expressionDocument).success).toBe(true)

    const dialog = {
      ...dialogSurface(),
      parameters: [{ name: 'row', required: true }],
      outputs: [{ name: 'saved' }],
    } as ProjectSurface
    const itemAndResultDocument = documentFixture({
      surfaceOrder: ['home', 'dialog'],
      surfacesById: {
        home: {
          ...pageSurface(),
          interactions: [{
            kind: 'primaryUiAction',
            id: 'open-row',
            nodeId: 'name',
            trigger: 'itemActivate',
            action: {
              kind: 'open',
              targetSurfaceId: 'dialog',
              parameters: [{
                name: 'row',
                value: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['id'] } },
              }],
              onResults: [{
                resultName: 'saved',
                assignments: [{
                  targetFieldId: 'name',
                  value: { version: 1, ast: { kind: 'reference', scope: 'result', path: [] } },
                }],
              }],
            },
          }],
        },
        dialog,
      },
    })
    expect(() => parseProjectDocument(itemAndResultDocument)).not.toThrow()
    expect(parseProjectDocument(itemAndResultDocument).success).toBe(true)
  })

  it('rejects invalid Safe Expression selectors and function arity without throwing', () => {
    const parseExpression = (ast: unknown) => parseProjectDocument({
      ...documentFixture(),
      surfacesById: {
        home: {
          ...pageSurface(),
          interactions: [{
            kind: 'stateProjection',
            id: 'invalid-expression',
            target: { kind: 'state', nodeId: 'name', key: 'visible' },
            value: { version: 1, ast },
          }],
        },
      },
    })
    const invalidSelector = {
      kind: 'reference',
      scope: 'parameters',
      selector: 'root',
      path: ['name'],
    }
    const invalidArity = { kind: 'call', callee: 'trim', args: [] }
    expect(() => parseExpression(invalidSelector)).not.toThrow()
    expect(parseExpression(invalidSelector)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'interaction_expression_invalid' }],
    })
    expect(() => parseExpression(invalidArity)).not.toThrow()
    expect(parseExpression(invalidArity)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'interaction_expression_invalid' }],
    })
  })

  it('rejects pathologically deep Safe Expressions without overflowing the Reader', () => {
    let ast: unknown = { kind: 'literal', value: true }
    for (let depth = 0; depth < 5000; depth += 1)
      ast = { kind: 'unary', operator: '!', operand: ast }
    const input = documentFixture({
      surfacesById: {
        home: {
          ...pageSurface(),
          interactions: [{
            kind: 'stateProjection',
            id: 'deep-expression',
            target: { kind: 'state', nodeId: 'name', key: 'visible' },
            value: { version: 1, ast } as never,
          }],
        },
      },
    })
    expect(() => parseProjectDocument(input)).not.toThrow()
    expect(parseProjectDocument(input)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'interaction_expression_invalid' }],
    })
  })

  it('rejects dangerous static Resource URLs and accepts canonical URLs', () => {
    const parseUrl = (url: string) => parseProjectDocument(documentFixture({
      resources: {
        logo: { id: 'logo', kind: 'url', name: 'Logo', url },
      },
    }))
    expect(parseUrl('/assets/logo.png').success).toBe(true)
    expect(parseUrl('https://example.com/logo.png').success).toBe(true)
    expect(parseUrl('https://example.com/logo.png?next=/../safe').success).toBe(true)
    for (const invalid of [
      '//evil.example/logo.png',
      '/%2e%2e/secret',
      'https://example.com/%2e%2e/secret',
      '/safe\nheader',
    ])
      expect(parseUrl(invalid).success).toBe(false)
  })

  it('returns stable codes and structured context for cross-asset failures', () => {
    const danglingDataset = parseProjectDocument(documentFixture({
      surfacesById: {
        home: pageSurface('home', '/', fieldNode('name', 'name', {
          datasetBindings: {
            options: {
              datasetId: 'missing-dataset',
              projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
            },
          },
        })),
      },
    }))
    expect(danglingDataset).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'dataset_reference_invalid',
        datasetId: 'missing-dataset',
        surfaceId: 'home',
        nodeId: 'name',
        context: { datasetId: 'missing-dataset', surfaceId: 'home', nodeId: 'name' },
      }],
    })

    const danglingResource = parseProjectDocument(documentFixture({
      surfacesById: {
        home: pageSurface('home', '/', fieldNode('name', 'name', {
          resourceBindings: { icon: { resourceId: 'missing-resource' } },
        })),
      },
    }))
    expect(danglingResource).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'resource_reference_invalid',
        resourceId: 'missing-resource',
        surfaceId: 'home',
        nodeId: 'name',
      }],
    })

    const dialog = dialogSurface()
    const invalidHome = parseProjectDocument(documentFixture({
      homeSurfaceId: 'dialog',
      surfaceOrder: ['home', 'dialog'],
      surfacesById: { home: pageSurface(), dialog },
    }))
    expect(invalidHome).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'invalid_surface_kind',
        surfaceId: 'dialog',
        context: { expectedKinds: ['page'], receivedKind: 'dialog' },
      }],
    })

    const invalidTarget = parseProjectDocument(documentFixture({
      surfacesById: {
        home: {
          ...pageSurface(),
          interactions: [{
            kind: 'primaryUiAction',
            id: 'open-missing',
            nodeId: 'name',
            trigger: 'activate',
            action: { kind: 'open', targetSurfaceId: 'missing-dialog', parameters: [] },
          }],
        },
      },
    }))
    expect(invalidTarget).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'invalid_surface_reference',
        context: {
          sourceSurfaceId: 'home',
          nodeId: 'name',
          targetSurfaceId: 'missing-dialog',
        },
      }],
    })
  })
})

describe('registry snapshot v3', () => {
  function contract(): ComponentContract {
    return {
      key: 'element.input',
      version: '1',
      kind: 'field',
      props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
      bindings: [{ name: 'value', valueProp: 'modelValue', trigger: 'change' }],
      slots: [],
      allowedParents: [],
      defaults: {},
      semanticTriggers: ['activate'],
      stateProjectionProperties: [['props', 'placeholder']],
      datasetBindings: [],
      resourceBindings: [],
    }
  }

  it('fingerprints all v3 capability fields and requires canonical component order', () => {
    const registry = createComponentContractRegistry([contract()], { adapter: 'element-plus', version: '1.0.0' })
    const snapshot = createRegistryContractSnapshot(registry)
    expect(snapshot.version).toBe(REGISTRY_CONTRACT_SNAPSHOT_VERSION)
    expect(parseRegistryContractSnapshot(snapshot).success).toBe(true)
    const changed = {
      ...snapshot,
      components: snapshot.components.map((component, index) => index === 0
        ? { ...component, contract: { ...component.contract, semanticTriggers: ['submit'] } }
        : component),
    }
    expect(parseRegistryContractSnapshot(changed)).toMatchObject({ success: false })
    expect(() => assertRegistryContractSnapshot({ ...snapshot, version: 2 })).toThrow()
  })

  it('rejects malformed Registry identities and duplicate capability declarations', () => {
    expect(() => createComponentContractRegistry([contract()], {
      adapter: ' element-plus ',
      version: '1.0.0',
    })).toThrowError(expect.objectContaining({ code: 'MODEL_REGISTRY_IDENTITY_INVALID' }))
    expect(() => createComponentContractRegistry([contract()], {
      adapter: 'element-plus',
      version: ' 1.0.0 ',
    })).toThrowError(expect.objectContaining({ code: 'MODEL_REGISTRY_IDENTITY_INVALID' }))

    const registry = createComponentContractRegistry([contract()], { adapter: 'element-plus', version: '1.0.0' })
    const snapshot = createRegistryContractSnapshot(registry)
    const duplicatedContract: ComponentContract = {
      ...contract(),
      semanticTriggers: ['activate', 'activate'],
    }
    const fingerprint = componentContractFingerprint(duplicatedContract)
    const duplicateSnapshot = {
      ...structuredClone(snapshot),
      components: [{
        ...structuredClone(snapshot.components[0]!),
        fingerprint,
        contract: duplicatedContract,
      }],
      fingerprint: registryLockFingerprint({
        [duplicatedContract.key]: {
          contractVersion: duplicatedContract.version,
          fingerprint,
        },
      }),
    }
    expect(parseRegistryContractSnapshot(duplicateSnapshot)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_REGISTRY_SNAPSHOT_INVALID' }],
    })
  })

  it('keeps dotted and segmented projection paths distinct with order-stable fingerprints', () => {
    const original: ComponentContract = {
      ...contract(),
      stateProjectionProperties: [['a.b'], ['a', 'b']],
    }
    const reordered: ComponentContract = {
      ...structuredClone(original),
      stateProjectionProperties: [...original.stateProjectionProperties].reverse(),
    }
    expect(() => createComponentContractRegistry([original], {
      adapter: 'element-plus',
      version: '1.0.0',
    })).not.toThrow()
    expect(componentContractFingerprint(original)).toBe(componentContractFingerprint(reordered))
  })
})

describe('surface transactions and history', () => {
  it('applies Surface/node changes atomically and reports the new change set', () => {
    const document = documentFixture()
    const result = applyProjectTransaction(document, {
      id: 'rename-and-props',
      label: 'Rename and patch',
      operations: [
        { type: 'surface.rename', surfaceId: 'home', name: 'Landing' },
        { type: 'node.props', surfaceId: 'home', nodeId: 'name', props: { placeholder: 'Name' } },
      ],
    })
    expect(result).toMatchObject({
      success: true,
      changed: true,
      changeSet: { project: false, surfaceIds: ['home'], datasetIds: [], resourceIds: [] },
    })
    if (!result.success)
      return
    expect(result.document.surfacesById.home!.name).toBe('Landing')
    expect(result.document.surfacesById.home!.graph.nodesById.name!.props).toEqual({ placeholder: 'Name' })
    const undone = applyProjectTransaction(result.document, result.inverse)
    expect(undone.success && undone.document).toEqual(document)
  })

  it('keeps command history Surface-scoped and idempotent', () => {
    const engine = createProjectDomainEngine({ document: createProjectSnapshot(documentFixture()) })
    const command = {
      id: 'rename-home',
      label: 'Rename home',
      actions: [{
        type: 'operation.apply' as const,
        operations: [{ type: 'surface.rename' as const, surfaceId: 'home', name: 'Landing' }],
      }],
    }
    expect(engine.execute(command).changed).toBe(true)
    expect(engine.execute(command).changed).toBe(false)
    expect(engine.snapshot.document.surfacesById.home!.name).toBe('Landing')
    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.surfacesById.home!.name).toBe('Home')
  })

  it('patches field-level required settings atomically and restores them on undo', () => {
    const engine = createProjectDomainEngine({ document: createProjectSnapshot(documentFixture()) })
    const result = engine.execute({
      id: 'set-name-required',
      label: 'Set name required',
      actions: [{
        type: 'node.patch',
        surfaceId: 'home',
        nodeId: 'name',
        patch: { set: { required: true, requiredMessage: '请输入姓名' } },
      }],
    })

    expect(result.changed).toBe(true)
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.name).toMatchObject({
      required: true,
      requiredMessage: '请输入姓名',
    })
    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.name).not.toHaveProperty('required')
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.name).not.toHaveProperty('requiredMessage')
  })

  it('blocks removal of referenced Dataset and Resource assets', () => {
    const document = documentFixture({
      datasetOrder: ['options'],
      datasetsById: { options: { id: 'options', name: 'Options', rows: [{ label: 'A', value: 'a' }] } },
      surfacesById: {
        home: pageSurface('home', '/', fieldNode('choice', 'choice', {
          datasetBindings: {
            options: {
              datasetId: 'options',
              projection: { kind: 'options', labelPath: ['label'], valuePath: ['value'] },
            },
          },
        })),
      },
    })
    const result = applyProjectTransaction(document, {
      id: 'remove-dataset',
      label: 'Remove dataset',
      operations: [{ type: 'dataset.remove', datasetId: 'options' }],
    })
    expect(result).toMatchObject({ success: false, diagnostics: [{ code: 'dataset_reference_invalid' }] })
  })
})

describe('memory Repository and transfer contracts', () => {
  it('rejects old, future, and missing transfer versions with JSON-safe context', async () => {
    const project = {
      kind: 'config-form-project',
      document: documentFixture(),
      embeddedContents: [],
    }
    const surface = {
      kind: 'config-form-surface',
      rootSurfaceId: 'home',
      surfaceOrder: ['home'],
      surfacesById: { home: pageSurface() },
      datasetOrder: [],
      datasetsById: {},
      resources: {},
      embeddedContents: [],
      registryLock: structuredClone(REGISTRY_LOCK),
    }
    for (const version of [undefined, 0, 2]) {
      const projectInput = version === undefined ? project : { ...project, version }
      const surfaceInput = version === undefined ? surface : { ...surface, version }
      expect(await readProjectTransfer(projectInput)).toMatchObject({
        success: false,
        diagnostics: [{
          code: 'unsupported_contract_version',
          context: { contract: 'ProjectTransfer', expected: 1, received: version ?? null },
        }],
      })
      expect(await readSurfaceTransfer(surfaceInput)).toMatchObject({
        success: false,
        diagnostics: [{
          code: 'unsupported_contract_version',
          context: { contract: 'SurfaceTransfer', expected: 1, received: version ?? null },
        }],
      })
    }
  })

  it('fails closed when Project transfer inspection triggers hostile getters', async () => {
    const hostileEnvelope = new Proxy({}, {
      has() {
        throw new Error('hostile version getter')
      },
    })
    const hostileDocument = new Proxy({}, {
      ownKeys() {
        throw new Error('hostile document getter')
      },
    })

    await expect(readProjectTransfer(hostileEnvelope)).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'project_structure_invalid' }],
    })
    await expect(readProjectTransfer({
      kind: 'config-form-project',
      version: 1,
      document: hostileDocument,
      embeddedContents: [],
    })).resolves.toMatchObject({
      success: false,
      diagnostics: [{ code: 'project_structure_invalid' }],
    })
  })

  it('stores embedded bytes atomically, isolates copies, and preserves Surface revisions', async () => {
    const { document, write } = await resourceDocument()
    const repository = createMemoryProjectRepository({ now: () => '2026-09-18T00:01:00.000Z' })
    const created = await repository.create({
      document,
      embeddedContents: [write],
      seed: { repositoryRevision: 0, createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z' },
    })
    write.bytes[0] = 9
    const first = await repository.readEmbedded({ projectId: 'project', resourceId: 'logo', contentHash: write.contentHash })
    expect(first).toEqual(new Uint8Array([1, 2, 3]))
    first![0] = 8
    expect(await repository.readEmbedded({ projectId: 'project', resourceId: 'logo', contentHash: write.contentHash })).toEqual(new Uint8Array([1, 2, 3]))
    expect((await repository.list())[0]).toMatchObject({ homeSurfaceId: 'home', surfaceCount: 1, resourceCount: 1 })
    expect(created.entityRevisions.surfaces.home).toBe(0)
  })

  it('requires exact bytes on create and replays commits by command id', async () => {
    const { document, write } = await resourceDocument()
    const repository = createMemoryProjectRepository()
    await expect(repository.create({ document, embeddedContents: [] })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    const created = await repository.create({ document, embeddedContents: [write] })
    const input = {
      commandId: 'rename',
      document: documentFixture({ name: 'Changed' }),
      expectedRepositoryRevision: created.repositoryRevision,
      id: document.id,
      metadata: { source: 'manual' as const },
    }
    const committed = await repository.commit(input)
    expect((await repository.commit(input)).replayed).toBe(true)
    expect(committed.project.repositoryRevision).toBe(1)
  })

  it('serializes concurrent creates and compare-and-swap commits per project', async () => {
    const createRepository = createMemoryProjectRepository()
    const createResults = await Promise.allSettled([
      createRepository.create({ document: documentFixture({ name: 'First' }), embeddedContents: [] }),
      createRepository.create({ document: documentFixture({ name: 'Second' }), embeddedContents: [] }),
    ])
    expect(createResults.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(createResults.find(result => result.status === 'rejected')).toMatchObject({
      reason: { code: 'PROJECT_REPOSITORY_EXISTS' },
    })

    const commitRepository = createMemoryProjectRepository()
    const created = await commitRepository.create({ document: documentFixture(), embeddedContents: [] })
    const commitResults = await Promise.allSettled([
      commitRepository.commit({
        commandId: 'concurrent-a',
        document: documentFixture({ name: 'A' }),
        expectedRepositoryRevision: created.repositoryRevision,
        id: 'project',
        metadata: { source: 'manual' },
      }),
      commitRepository.commit({
        commandId: 'concurrent-b',
        document: documentFixture({ name: 'B' }),
        expectedRepositoryRevision: created.repositoryRevision,
        id: 'project',
        metadata: { source: 'manual' },
      }),
    ])
    expect(commitResults.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(commitResults.find(result => result.status === 'rejected')).toMatchObject({
      reason: { code: 'PROJECT_REVISION_CONFLICT' },
    })
    expect((await commitRepository.get('project'))?.repositoryRevision).toBe(1)
  })

  it('captures commit inputs before yielding and rejects command reuse with a later mutation', async () => {
    const repository = createMemoryProjectRepository()
    const created = await repository.create({ document: documentFixture(), embeddedContents: [] })
    const input: ProjectRepositoryCommitInput = {
      commandId: 'captured-input',
      document: documentFixture({ name: 'Captured' }),
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    }
    const pending = repository.commit(input)
    input.document.name = 'Mutated after call'
    const committed = await pending
    expect(committed.project.document.name).toBe('Captured')
    expect((await repository.get('project'))?.document.name).toBe('Captured')
    await expect(repository.commit(input)).rejects.toMatchObject({
      code: 'PROJECT_REPOSITORY_COMMAND_REUSED',
    })
  })

  it('classifies incoming embedded metadata mismatch as an invalid commit', async () => {
    const { document, write } = await resourceDocument()
    const repository = createMemoryProjectRepository()
    const created = await repository.create({ document, embeddedContents: [write] })
    const invalidDocument = structuredClone(document)
    const logo = invalidDocument.resources.logo
    if (!logo || logo.kind !== 'embedded')
      throw new TypeError('Expected embedded logo fixture.')
    logo.byteLength += 1
    await expect(repository.commit({
      commandId: 'invalid-resource-metadata',
      document: invalidDocument,
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    expect(await repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: write.contentHash,
    })).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('round-trips Project and flat Surface transfer envelopes', async () => {
    const { document, write } = await resourceDocument(new Uint8Array([4, 5, 6]))
    const dialog = dialogSurface()
    const source: ProjectDocument = {
      ...document,
      surfaceOrder: ['home', 'dialog'],
      surfacesById: {
        home: {
          ...document.surfacesById.home!,
          graph: {
            ...document.surfacesById.home!.graph,
            nodesById: {
              name: fieldNode('name', 'name', {
                resourceBindings: { icon: { resourceId: 'logo' } },
              }),
            },
            root: [{ nodeId: 'name', placement: {} }],
          },
        },
        dialog,
      },
    }
    const read = async () => new Uint8Array(write.bytes)
    const projectEnvelope = await writeProjectTransfer({ document: source, readEmbedded: async () => read() })
    expect(projectEnvelope.success).toBe(true)
    if (!projectEnvelope.success)
      return
    const projectRoundTrip = await readProjectTransfer(JSON.parse(JSON.stringify(projectEnvelope.data)))
    expect(projectRoundTrip).toMatchObject({ success: true, data: { document: source } })
    const normalizedIdentity = structuredClone(projectEnvelope.data)
    normalizedIdentity.embeddedContents[0]!.resourceId = ' logo '
    expect(await readProjectTransfer(normalizedIdentity)).toMatchObject({ success: false })

    const surfaceEnvelope = await writeSurfaceTransfer({ document: source, rootSurfaceId: 'home', readEmbedded: async () => read() })
    expect(surfaceEnvelope.success).toBe(true)
    if (!surfaceEnvelope.success)
      return
    expect(surfaceEnvelope.data.surfaceOrder).toEqual(['home'])
    const surfaceRoundTrip = await readSurfaceTransfer(JSON.parse(JSON.stringify(surfaceEnvelope.data)))
    expect(surfaceRoundTrip).toMatchObject({ success: true, data: { surfaceOrder: ['home'], datasetOrder: [] } })
    const nonCanonical = structuredClone(surfaceEnvelope.data)
    nonCanonical.embeddedContents[0]!.content.data += '\n'
    expect(await readSurfaceTransfer(nonCanonical)).toMatchObject({ success: false, diagnostics: [{ code: 'resource_content_invalid' }] })
  })

  it('rejects transfer metadata budgets before reading embedded bytes', async () => {
    const { document } = await resourceDocument()
    const oversized = structuredClone(document)
    const logo = oversized.resources.logo
    if (!logo || logo.kind !== 'embedded')
      throw new TypeError('Expected embedded logo fixture.')
    logo.byteLength = 10 * 1024 * 1024 + 1
    let reads = 0
    const oversizedResult = await writeProjectTransfer({
      document: oversized,
      readEmbedded: async () => {
        reads += 1
        throw new Error('Resource reader must not run for over-budget metadata.')
      },
    })
    expect(reads).toBe(0)
    expect(oversizedResult).toMatchObject({
      success: false,
      diagnostics: [{ context: { reason: 'resource_budget_exceeded' } }],
    })

    const aggregate = documentFixture({
      resources: Object.fromEntries(Array.from({ length: 6 }, (_, index) => {
        const id = `asset-${index}`
        return [id, {
          id,
          kind: 'embedded',
          name: id,
          fileName: `${id}.bin`,
          mediaType: 'application/octet-stream',
          byteLength: 9 * 1024 * 1024,
          contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        }]
      })),
    })
    const aggregateResult = await writeProjectTransfer({
      document: aggregate,
      readEmbedded: async () => {
        reads += 1
        throw new Error('Resource reader must not run for over-budget metadata.')
      },
    })
    expect(reads).toBe(0)
    expect(aggregateResult).toMatchObject({
      success: false,
      diagnostics: [{ context: { reason: 'aggregate_budget_exceeded' } }],
    })
  })

  it('treats Registry component maps as order-independent identities in Surface transfer', async () => {
    const components: RegistryLock['components'] = {
      'element.action': { contractVersion: '1', fingerprint: 'fnv1a:87654321' },
      'element.input': { contractVersion: '1', fingerprint: 'fnv1a:12345678' },
    }
    const lock: RegistryLock = {
      adapter: 'element-plus',
      version: '1.0.0',
      fingerprint: registryLockFingerprint(components),
      components,
    }
    const source = documentFixture({
      registryLock: lock,
      surfacesById: {
        home: {
          ...pageSurface(),
          graph: {
            ...pageSurface().graph,
            root: [
              { nodeId: 'name', placement: {} },
              { nodeId: 'save', placement: {} },
            ],
            nodesById: {
              name: fieldNode(),
              save: { id: 'save', component: 'element.action', kind: 'element', props: {} },
            },
          },
        },
      },
    })
    const written = await writeSurfaceTransfer({
      document: source,
      rootSurfaceId: 'home',
      readEmbedded: async () => undefined,
    })
    expect(written.success).toBe(true)
    if (!written.success)
      return
    const reversed = structuredClone(written.data)
    reversed.registryLock.components = Object.fromEntries(
      Object.entries(reversed.registryLock.components).reverse(),
    )
    expect(await readSurfaceTransfer(reversed)).toMatchObject({ success: true })
  })

  it('computes the exact Surface dependency closure', () => {
    const dialog = dialogSurface()
    const document = documentFixture({
      surfaceOrder: ['home', 'dialog'],
      surfacesById: { home: pageSurface(), dialog },
    })
    expect(collectSurfaceDependencyClosure(document, 'dialog')).toEqual({
      surfaceIds: ['dialog'],
      datasetIds: [],
      resourceIds: [],
    })
  })
})
