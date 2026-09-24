import type { ProjectCompilation, SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { PrototypeSessionV1 } from '@moluoxixi/config-form-prototype-runtime/session'
import {
  CANONICAL_PROJECT_IR_VERSION,
  compileCanonicalProject,
  compileCanonicalSurface,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import {
  createPrototypeProjectContext,
  initializePrototypeProjectSession,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { describe, expect, it } from 'vitest'
import {
  acceptsRuntimeHostMessageEvent,
  isParentToRuntimeHostMessage,
  isRuntimeHostToParentMessage,
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '..'
import { createCompilerFixture } from './compiler-fixture'

const base = { channel: RUNTIME_HOST_CHANNEL, version: RUNTIME_HOST_PROTOCOL_VERSION, hostId: 'runtime-host', projectId: 'project', revision: 'revision-1', sequence: 1 }
const emptyState = { fields: [], touched: [], validation: {}, values: {} }

async function compilations(): Promise<{ project: ProjectCompilation, surface: SurfaceCompilation }> {
  const fixture = createCompilerFixture(3)
  const project = compileCanonicalProject(fixture)
  const surface = compileCanonicalSurface({ ...fixture, surfaceId: fixture.snapshot.document.homeSurfaceId })
  if (!project.success || !surface.success)
    throw new Error('Runtime Host protocol fixture compilation failed.')
  return { project: project.compilation, surface: surface.compilation }
}

function session(surfaceId = 'home', projectId = base.projectId): PrototypeSessionV1 {
  return { version: 1, projectId, pageHistory: ['page-1'], overlayStack: [], instancesById: {
    'page-1': { instanceId: 'page-1', surfaceId, parameters: {}, values: {}, runtime: { nodeAddresses: [], fieldInstances: [] }, projection: [] },
  } }
}

async function designSync() {
  const { surface } = await compilations()
  return { ...base, type: 'design.sync', surfaceId: surface.key.surfaceId, payload: { adapter: 'element-plus', breakpoint: 'desktop', compilation: surface, locale: 'zh-CN', runtimeSessionKey: 'runtime-project:home:design', runtimeState: emptyState, variant: 'canvas' } }
}

async function experienceSync() {
  const { project } = await compilations()
  const initialized = initializePrototypeProjectSession({
    compilation: project,
    homeInstanceId: 'page-1',
    createRowId: () => 'fixture-row',
  })
  if (!initialized.success)
    throw new Error('Runtime Host protocol session fixture failed.')
  return { ...base, type: 'experience.sync', sessionId: 'prototype-session', payload: { adapter: 'element-plus', compilation: project, locale: 'zh-CN', session: initialized.data } }
}

function child<T extends Record<string, unknown>>(payload: T): typeof base & T {
  return { ...base, sequence: 2, ...payload }
}
const rect = { bottom: 52, height: 40, left: 20, right: 220, top: 12, width: 200 }

describe('runtime host v7 protocol', () => {
  it('accepts structured-cloned Surface and Project compilation contracts', async () => {
    expect(isParentToRuntimeHostMessage(structuredClone(await designSync()))).toBe(true)
    expect(isParentToRuntimeHostMessage(structuredClone(await experienceSync()))).toBe(true)
  })

  it('requires exact v7 base keys and rejects Page-era identity', async () => {
    const message = await designSync()
    for (const version of [6, RUNTIME_HOST_PROTOCOL_VERSION + 1, undefined]) expect(isParentToRuntimeHostMessage({ ...message, version })).toBe(false)
    for (const missingKey of ['channel', 'version', 'hostId', 'projectId', 'revision', 'sequence']) {
      const withoutKey = Object.fromEntries(Object.entries(message).filter(([key]) => key !== missingKey))
      expect(isParentToRuntimeHostMessage(withoutKey)).toBe(false)
    }
    expect(isParentToRuntimeHostMessage({ ...message, pageId: 'home' })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, unexpected: true })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, hostId: '' })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, projectId: '' })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, sequence: -1 })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, sequence: 1.5 })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, revision: undefined })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, payload: { ...message.payload, namespace: undefined } })).toBe(false)
  })

  it('requires the current Surface IR/compiler contract and rejects Page shapes', async () => {
    const message = await designSync()
    const compilation = message.payload.compilation
    const replaceKey = (key: Record<string, unknown>) => ({ ...message, payload: { ...message.payload, compilation: { ...compilation, key } } })
    expect(isParentToRuntimeHostMessage(replaceKey({ ...compilation.key, irVersion: CANONICAL_PROJECT_IR_VERSION - 1 }))).toBe(false)
    expect(isParentToRuntimeHostMessage(replaceKey({ ...compilation.key, irVersion: CANONICAL_PROJECT_IR_VERSION + 1 }))).toBe(false)
    expect(isParentToRuntimeHostMessage(replaceKey({ ...compilation.key, compilerVersion: `${CONFIG_FORM_COMPILER_VERSION}-future` }))).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, payload: { ...message.payload, compilation: { ...compilation, page: compilation.surface } } })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, surfaceId: 'other-surface' })).toBe(false)
  })

  it('requires ProjectCompilation and an exact matching PrototypeSession for Experience', async () => {
    const message = await experienceSync()
    const design = await designSync()
    const otherFixture = createCompilerFixture(4)
    const otherCompilation = compileCanonicalProject(otherFixture)
    if (!otherCompilation.success)
      throw new Error('Runtime Host mixed-contract fixture compilation failed.')
    expect(isParentToRuntimeHostMessage({ ...design, payload: { ...design.payload, compilation: message.payload.compilation } })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, payload: { ...message.payload, compilation: design.payload.compilation } })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      payload: {
        ...message.payload,
        compilation: { ...message.payload.compilation, snapshot: { pagesById: {}, pageOrder: [] } },
      },
    })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      payload: { ...message.payload, compilation: { ...message.payload.compilation, registry: {} } },
    })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      payload: {
        ...message.payload,
        compilation: { ...message.payload.compilation, snapshot: otherCompilation.compilation.snapshot },
      },
    })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      payload: {
        ...message.payload,
        compilation: {
          ...message.payload.compilation,
          registry: { ...message.payload.compilation.registry, adapter: 'mixed-adapter' },
        },
      },
    })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, payload: { ...message.payload, session: session('home', 'other-project') } })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, payload: { ...message.payload, session: { ...message.payload.session, instancesById: {} } } })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, payload: { ...message.payload, session: { ...message.payload.session, version: 2 } } })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...message, surfaceId: 'home' })).toBe(false)
  })

  it('accepts only namespaced v7 messages and rejects removed protocol families', async () => {
    const design = await designSync()
    const experience = await experienceSync()
    expect(isParentToRuntimeHostMessage({ ...design, type: 'design.state', payload: emptyState })).toBe(true)
    const { payload: _payload, ...experienceBase } = experience
    expect(isParentToRuntimeHostMessage({ ...experienceBase, type: 'experience.command', sessionId: 'prototype-session', command: { type: 'history.back' } })).toBe(true)
    expect(isParentToRuntimeHostMessage({ ...experienceBase, type: 'experience.command', sessionId: 'prototype-session', surfaceId: 'home', command: { type: 'history.back' } })).toBe(false)
    for (const type of ['sync', 'state', 'submit', 'submitResult', 'fieldChange', 'dataRequest', 'dataCancel', 'dataResult']) {
      expect(isParentToRuntimeHostMessage({ ...design, type })).toBe(false)
      expect(isRuntimeHostToParentMessage(child({ type }))).toBe(false)
    }

    const transition = child({
      type: 'experience.session',
      sessionId: 'prototype-session',
      transition: { session: experience.payload.session, diagnostics: [] },
    })
    const context = createPrototypeProjectContext(experience.payload.compilation)
    if (!context.success)
      throw new Error('Runtime Host protocol context fixture failed.')
    expect(isRuntimeHostToParentMessage(transition, context.data)).toBe(true)
    expect(isRuntimeHostToParentMessage({
      ...transition,
      transition: { ...transition.transition, effects: [] },
    })).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...transition, surfaceId: 'home' })).toBe(false)
  })

  it('validates finite exact geometry and pointer payloads', () => {
    const geometry = child({ type: 'design.geometry', surfaceId: 'home', payload: { layoutRect: rect, nodes: [{ depth: 1, nodeId: 'name', order: 0, path: 'root.0', rect }], surfaceRect: rect, viewport: { height: 480, width: 900 } } })
    expect(isRuntimeHostToParentMessage(geometry)).toBe(true)
    expect(isRuntimeHostToParentMessage({ ...geometry, payload: { ...geometry.payload, extra: true } })).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...geometry, payload: { ...geometry.payload, surfaceRect: { ...rect, right: Number.POSITIVE_INFINITY } } })).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...geometry, payload: { ...geometry.payload, viewport: { height: Number.NaN, width: 900 } } })).toBe(false)
    const pointer = child({ type: 'design.pointerMove', surfaceId: 'home', payload: { button: 0, clientX: 12, clientY: 24, ctrlKey: false, metaKey: false, nodeId: 'name', pointerId: 7, shiftKey: false } })
    expect(isRuntimeHostToParentMessage(pointer)).toBe(true)
    expect(isRuntimeHostToParentMessage({ ...pointer, payload: { ...pointer.payload, clientX: Number.NaN } })).toBe(false)
  })

  it('validates address-based runtime state and Experience instance snapshots', () => {
    const state = { fields: [{ address: { nodeId: 'name', scope: [] }, instanceKey: 'name', valuePath: ['name'] }], values: { name: 'Ada' }, touched: ['name'], validation: { name: ['Required'] } }
    expect(isRuntimeHostToParentMessage(child({ type: 'design.runtimeState', surfaceId: 'home', payload: state }))).toBe(true)
    expect(isRuntimeHostToParentMessage(child({ type: 'experience.instanceState', sessionId: 'prototype-session', instanceId: 'page-1', payload: { ...state, surfaceId: 'home', stateRevision: 1, projection: [] } }))).toBe(true)
    expect(isRuntimeHostToParentMessage(child({ type: 'experience.instanceState', sessionId: 'prototype-session', instanceId: 'page-1', payload: { ...state, surfaceId: 'home', stateRevision: Number.POSITIVE_INFINITY, projection: [] } }))).toBe(false)
    expect(isRuntimeHostToParentMessage(child({ type: 'design.runtimeState', surfaceId: 'home', payload: { ...state, fields: [{ nodeId: 'name', scope: [], instanceKey: 'name', valuePath: ['name'] }] } }))).toBe(false)
    expect(isRuntimeHostToParentMessage(child({ type: 'design.runtimeState', surfaceId: 'home', sessionId: 'prototype-session', payload: state }))).toBe(false)
    expect(isRuntimeHostToParentMessage(child({ type: 'design.runtimeState', surfaceId: 'home', payload: { ...state, extra: true } }))).toBe(false)
  })

  it('accepts events only from the expected origin, source, host, project, and revision', async () => {
    const message = await designSync()
    const source = {} as MessageEventSource
    const event = { data: message, origin: 'https://workbench.test', source } as MessageEvent<unknown>
    const options = { guard: isParentToRuntimeHostMessage, origin: 'https://workbench.test', source, hostId: message.hostId, projectId: message.projectId, revision: message.revision }
    expect(acceptsRuntimeHostMessageEvent(event, options)).toEqual(message)
    expect(acceptsRuntimeHostMessageEvent(event, { ...options, hostId: 'other-host' })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, { ...options, projectId: 'other-project' })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, { ...options, revision: 'stale' })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, { ...options, origin: 'https://other.test' })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, { ...options, source: {} as MessageEventSource })).toBeUndefined()
  })
})
