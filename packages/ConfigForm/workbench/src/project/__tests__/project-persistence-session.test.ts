import type {
  ProjectChangeSet,
  ProjectCommand,
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
} from '@moluoxixi/config-form-model'
import type { ProjectEditorSession, ProjectEditorSessionSnapshot } from '..'
import type { ProjectRecoveryDraftStore } from '../persistence'
import {
  createMemoryProjectRepository,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { createProjectEditorSession } from '..'
import { createMemoryProjectRecoveryDraftStore, createProjectPersistenceSession } from '../persistence'

class TestClock {
  private current = 0
  private nextId = 0
  private readonly tasks = new Map<number, { at: number, callback: () => void }>()

  readonly clock = {
    clearTimeout: (timer: unknown) => this.tasks.delete(Number(timer)),
    now: () => this.current,
    setTimeout: (callback: () => void, delayMs: number) => {
      const id = ++this.nextId
      this.tasks.set(id, { at: this.current + delayMs, callback })
      return id
    },
  }

  async advance(delayMs: number): Promise<void> {
    const target = this.current + delayMs
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0]
      if (!next)
        break
      this.current = next[1].at
      this.tasks.delete(next[0])
      next[1].callback()
      await Promise.resolve()
      await Promise.resolve()
    }
    this.current = target
    await Promise.resolve()
  }
}

function projectDocument(): ProjectDocument {
  const registryComponents = {
    'element.input': {
      contractVersion: '1',
      fingerprint: 'fnv1a:00000001',
    },
  }
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Fixture project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: 'Home',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: {},
          form: {},
          root: [{ nodeId: 'name-field', placement: {} }],
          nodesById: {
            'name-field': {
              id: 'name-field',
              component: 'element.input',
              kind: 'field',
              field: 'name',
              props: {},
            },
          },
        },
      },
    },
    datasetOrder: ['countries'],
    datasetsById: {
      countries: {
        id: 'countries',
        name: 'Countries',
        rows: [{ code: 'CN', label: 'China' }],
      },
    },
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: {
      adapter: 'element-plus',
      version: '1.0.0',
      fingerprint: registryLockFingerprint(registryComponents),
      components: registryComponents,
    },
    settings: {},
  }
}

async function contentHash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

async function withEmbeddedResource(
  document: ProjectDocument,
  bytes: Uint8Array,
): Promise<{ document: ProjectDocument, writes: ProjectEmbeddedResourceWrite[] }> {
  const next = structuredClone(document)
  const hash = await contentHash(bytes)
  next.resources.logo = {
    id: 'logo',
    name: 'Logo',
    kind: 'embedded',
    fileName: 'logo.bin',
    mediaType: 'application/octet-stream',
    byteLength: bytes.byteLength,
    contentHash: hash,
  }
  return {
    document: next,
    writes: [{ resourceId: 'logo', contentHash: hash, bytes: new Uint8Array(bytes) }],
  }
}

function emptyChangeSet(): ProjectChangeSet {
  return {
    project: false,
    surfaceIds: [],
    datasetIds: [],
    resourceIds: [],
    nodeChanges: [],
  }
}

function renameCommand(id: string, name: string, mergeKey = 'surface:home:name'): ProjectCommand {
  return {
    id,
    label: 'Rename Surface',
    mergeKey,
    actions: [{
      type: 'operation.apply',
      operations: [{ type: 'surface.rename', surfaceId: 'home', name }],
    }],
  }
}

function assetChangeCommand(): ProjectCommand {
  return {
    id: 'change-assets',
    label: 'Change project assets',
    actions: [{
      type: 'operation.apply',
      operations: [
        { type: 'surface.rename', surfaceId: 'home', name: 'Draft Surface' },
        { type: 'dataset.rename', datasetId: 'countries', name: 'Updated countries' },
        { type: 'resource.rename', resourceId: 'logo', name: 'Updated logo' },
        { type: 'node.props', surfaceId: 'home', nodeId: 'name-field', props: { placeholder: 'Updated' } },
      ],
    }],
  }
}

function durableRepository(base = createMemoryProjectRepository()): ProjectRepository {
  return {
    persistence: 'durable',
    close: () => base.close(),
    commit: input => base.commit(input),
    create: input => base.create(input),
    delete: id => base.delete(id),
    get: id => base.get(id),
    getVersion: (id, revision) => base.getVersion(id, revision),
    list: () => base.list(),
    listVersions: id => base.listVersions(id),
    pruneVersions: (id, policy) => base.pruneVersions(id, policy),
    readEmbedded: input => base.readEmbedded(input),
    setVersionLabel: input => base.setVersionLabel(input),
  }
}

function durableDraftStore(): ProjectRecoveryDraftStore {
  const base = createMemoryProjectRecoveryDraftStore()
  return {
    persistence: 'durable',
    close: () => base.close(),
    delete: id => base.delete(id),
    get: id => base.get(id),
    list: id => base.list(id),
    put: capture => base.put(capture),
  }
}

async function setup(options: {
  document?: ProjectDocument
  embeddedContents?: readonly ProjectEmbeddedResourceWrite[]
  readEmbedded?: ProjectRepository['readEmbedded']
  repository?: ProjectRepository
} = {}) {
  const repository = options.repository ?? durableRepository()
  const document = options.document ?? projectDocument()
  const project = await repository.create({
    document,
    embeddedContents: options.embeddedContents ?? [],
  })
  const editor = createProjectEditorSession({ project, repository })
  const clock = new TestClock()
  const drafts = durableDraftStore()
  const persistence = createProjectPersistenceSession({
    clock: clock.clock,
    draftStore: drafts,
    editor,
    readEmbedded: options.readEmbedded ?? (input => editor.readEmbedded(input)),
    sessionId: 'test-session',
  })
  return { clock, document, drafts, editor, persistence, repository }
}

describe('projectPersistenceSession', () => {
  it('persists a durable Surface recovery draft before the autosave window', async () => {
    const { clock, drafts, editor, persistence } = await setup()
    editor.execute(renameCommand('rename-draft', 'Draft'))
    expect(persistence.snapshot).toMatchObject({
      beforeUnloadRequired: true,
      draftCoverage: 'pending',
      status: 'pending',
    })

    await clock.advance(250)
    await vi.waitFor(() => expect(persistence.snapshot.draftCoverage).toBe('durable'))
    expect(persistence.snapshot.beforeUnloadRequired).toBe(false)
    await expect(drafts.get(persistence.draftId)).resolves.toMatchObject({
      baseRepositoryRevision: 0,
      document: { surfacesById: { home: { name: 'Draft' } } },
      version: 2,
    })
    await persistence.dispose()
  })

  it('captures complete embedded bytes and the new Surface/Dataset/Resource change set', async () => {
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const { clock, drafts, editor, persistence } = await setup({
      document: embedded.document,
      embeddedContents: embedded.writes,
    })
    editor.execute(assetChangeCommand())
    embedded.writes[0]!.bytes[0] = 9

    await clock.advance(250)
    await vi.waitFor(() => expect(persistence.snapshot.draftCoverage).toBe('durable'))
    const draft = await drafts.get(persistence.draftId)
    expect(draft).toMatchObject({
      version: 2,
      document: {
        surfacesById: { home: { name: 'Draft Surface' } },
        datasetsById: { countries: { name: 'Updated countries' } },
        resources: { logo: { name: 'Updated logo' } },
      },
    })
    expect(draft!.embeddedContents).toHaveLength(1)
    expect(draft!.embeddedContents[0]!.bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(draft!.changeSet.surfaceIds).toEqual(['home'])
    expect(draft!.changeSet.datasetIds).toEqual(['countries'])
    expect(draft!.changeSet.resourceIds).toEqual(['logo'])
    expect(draft!.changeSet.nodeChanges).toEqual([
      expect.objectContaining({ surfaceId: 'home', nodeId: 'name-field', kind: 'content' }),
    ])

    draft!.embeddedContents[0]!.bytes[0] = 8
    await expect(drafts.get(persistence.draftId)).resolves.toMatchObject({
      embeddedContents: [{ bytes: new Uint8Array([1, 2, 3]) }],
    })
    await persistence.dispose()
  })

  it('marks a draft failed without publishing a partial capture when bytes are unavailable', async () => {
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const { clock, drafts, editor, persistence } = await setup({
      document: embedded.document,
      embeddedContents: embedded.writes,
      readEmbedded: async () => undefined,
    })
    editor.execute(renameCommand('missing-bytes', 'Missing bytes'))

    await clock.advance(250)
    await vi.waitFor(() => expect(persistence.snapshot.draftCoverage).toBe('failed'))
    expect(persistence.snapshot.lastError).toMatchObject({ code: 'PROJECT_RECOVERY_DRAFT_WRITE_FAILED' })
    await expect(drafts.get(persistence.draftId)).resolves.toBeUndefined()
    await persistence.dispose()
  })

  it('autosaves during continuous input and coalesces revisions', async () => {
    const { clock, editor, persistence } = await setup()
    for (let index = 1; index <= 150; index += 1) {
      editor.execute(renameCommand(`rename-${index}`, `Surface ${index}`))
      await clock.advance(50)
    }

    await vi.waitFor(() => expect(editor.snapshot.repositoryRevision).toBeGreaterThanOrEqual(1))
    const intermediateRevision = editor.snapshot.repositoryRevision
    await clock.advance(800)
    await vi.waitFor(() => expect(editor.snapshot.dirty).toBe(false))
    expect(editor.snapshot.repositoryRevision).toBeLessThan(10)
    expect(editor.snapshot.repositoryRevision).toBeGreaterThanOrEqual(intermediateRevision)
    expect(editor.snapshot.document.surfacesById.home?.name).toBe('Surface 150')
    await persistence.dispose()
  })

  it('does not seal an Undo merge group at an autosave boundary', async () => {
    const { clock, editor, persistence } = await setup()
    editor.execute(renameCommand('rename-a', 'A'))
    await clock.advance(800)
    await vi.waitFor(() => expect(editor.snapshot.dirty).toBe(false))

    editor.execute(renameCommand('rename-b', 'B'))
    expect(editor.undo().changed).toBe(true)
    expect(editor.snapshot.document.surfacesById.home?.name).toBe('Home')
    await persistence.dispose()
  })

  it('rebases a newer draft after a captured save and drains the next save', async () => {
    const base = createMemoryProjectRepository()
    let releaseCommit!: () => void
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    let commitCount = 0
    const repository: ProjectRepository = {
      ...durableRepository(base),
      async commit(input: ProjectRepositoryCommitInput): Promise<ProjectRepositoryCommitResult> {
        commitCount += 1
        if (commitCount === 1)
          await commitGate
        return await base.commit(input)
      },
    }
    const { clock, drafts, editor, persistence } = await setup({ repository })
    editor.execute(renameCommand('rename-first', 'First'))
    await clock.advance(800)
    await vi.waitFor(() => expect(editor.snapshot.saving).toBe(true))
    editor.execute(renameCommand('rename-second', 'Second'))
    releaseCommit()
    await vi.waitFor(() => expect(editor.snapshot.repositoryRevision).toBe(1))
    await vi.waitFor(async () => {
      const draft = await drafts.get(persistence.draftId)
      expect(draft).toMatchObject({ baseRepositoryRevision: 1, editVersion: 2 })
    })

    await clock.advance(800)
    await vi.waitFor(() => expect(editor.snapshot.dirty).toBe(false))
    await vi.waitFor(() => expect(persistence.snapshot.status).toBe('saved'))
    expect(editor.snapshot.repositoryRevision).toBe(2)
    expect(editor.snapshot.document.surfacesById.home?.name).toBe('Second')
    await expect(drafts.get(persistence.draftId)).resolves.toBeUndefined()
    await persistence.dispose()
  })

  it('names the current clean revision without creating an empty revision', async () => {
    const { clock, editor, persistence, repository } = await setup()
    editor.execute(renameCommand('rename-release', 'Release'))
    await clock.advance(800)
    await vi.waitFor(() => expect(editor.snapshot.dirty).toBe(false))
    const revision = editor.snapshot.repositoryRevision

    await persistence.createNamedCheckpoint(' Release candidate ')
    expect(editor.snapshot.repositoryRevision).toBe(revision)
    expect(await repository.listVersions(editor.snapshot.document.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ repositoryRevision: revision, label: 'Release candidate' }),
    ]))
    await persistence.dispose()
  })

  it('keeps 2000-node draft capture scheduling below 4ms p95', async () => {
    const base = projectDocument()
    const nodeIds = Array.from({ length: 2_000 }, (_, index) => `perf-${index}`)
    const document: ProjectDocument = structuredClone(base)
    document.surfacesById.home!.graph.root = nodeIds.map(nodeId => ({ nodeId, placement: {} }))
    document.surfacesById.home!.graph.nodesById = Object.fromEntries(nodeIds.map((id, index) => [id, {
      id,
      component: 'element.input',
      kind: 'field' as const,
      field: `perf_${index}`,
      props: {},
    }]))
    let snapshot: ProjectEditorSessionSnapshot = {
      canRedo: false,
      canUndo: true,
      contentHash: 'content-0',
      createdAt: '2026-08-31T00:00:00.000Z',
      dirty: false,
      document,
      editVersion: 0,
      history: { entries: [], limit: 100, position: 0 },
      persistence: 'durable',
      repositoryRevision: 0,
      saving: false,
      updatedAt: '2026-08-31T00:00:00.000Z',
    }
    let publish: ((snapshot: ProjectEditorSessionSnapshot, changeSet: ProjectChangeSet) => void) | undefined
    const editor = {
      get snapshot() { return snapshot },
      execute: vi.fn(),
      redo: vi.fn(),
      save: vi.fn(),
      subscribe(listener: typeof publish) {
        publish = listener
        listener?.(snapshot, emptyChangeSet())
        return () => {
          publish = undefined
        }
      },
      undo: vi.fn(),
    } as unknown as ProjectEditorSession
    const clock = new TestClock()
    const persistence = createProjectPersistenceSession({
      clock: clock.clock,
      draftStore: durableDraftStore(),
      editor,
      readEmbedded: async () => undefined,
      sessionId: 'performance-session',
    })
    const durations: number[] = []
    for (let index = 1; index <= 30; index += 1) {
      snapshot = { ...snapshot, contentHash: `content-${index}`, dirty: true, editVersion: index }
      const startedAt = performance.now()
      publish?.(snapshot, {
        project: false,
        surfaceIds: ['home'],
        datasetIds: [],
        resourceIds: [],
        nodeChanges: [{ surfaceId: 'home', nodeId: `perf-${index}`, kind: 'content' }],
      })
      durations.push(performance.now() - startedAt)
    }
    durations.sort((left, right) => left - right)
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!
    expect(p95).toBeLessThan(4)
    await persistence.dispose()
  })
})
