import type { RuntimeHostSyncMessage } from '..'
import {
  CANONICAL_PROJECT_IR_VERSION,
  compileCanonicalPage,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  acceptsRuntimeHostMessageEvent,
  isParentToRuntimeHostMessage,
  isRuntimeHostToParentMessage,
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createBuiltInProjectFixture } from '../../project/__tests__/fixtures'

async function syncMessage(): Promise<RuntimeHostSyncMessage> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const project = createBuiltInProjectFixture('element-profile', {
    id: 'runtime-host-project',
    name: 'Runtime Host project',
  }, adapter.componentRegistry.lock)
  const pageId = project.homePageId
  const compiled = compileCanonicalPage({
    snapshot: createProjectSnapshot(project, 3),
    registry: adapter.registrySnapshot,
    pageId,
  })
  if (!compiled.success)
    throw new Error(compiled.diagnostics[0]?.message ?? 'Compilation failed.')

  return {
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId: 'runtime-host-session',
    projectId: project.id,
    pageId,
    sequence: 1,
    revision: 'runtime-host-project:3:home',
    type: 'sync',
    adapter: 'element-plus',
    compilation: compiled.compilation,
    mode: 'preview',
    locale: 'en-US',
    runtimeState: { fields: flatFields('name'), values: { name: 'Ada' }, touched: ['name'], validation: { name: ['Required'] } },
    namespace: 'el',
    reactionProjection: {
      values: { name: 'Ada' },
      props: {},
      states: {},
      validate: [],
    },
    runtimeSessionKey: 'runtime-host-project:element-plus:home',
  }
}

async function designSyncMessage(): Promise<RuntimeHostSyncMessage> {
  return {
    ...await syncMessage(),
    mode: 'design',
    design: {
      breakpoint: 'desktop',
      candidateId: 'candidate-node',
      candidateUsesFallback: false,
      canvasWidth: 900,
      variant: 'canvas',
    },
    runtimeSessionKey: 'runtime-host-project:element-plus:home:design',
  }
}

function childMessage(message: RuntimeHostSyncMessage, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId: message.hostId,
    projectId: message.projectId,
    pageId: message.pageId,
    sequence: 2,
    revision: message.revision,
    ...payload,
  }
}

const rect = {
  bottom: 52,
  height: 40,
  left: 20,
  right: 220,
  top: 12,
  width: 200,
}

describe('runtime host protocol', () => {
  it('structured-clones a real PageCompilation without leaking runtime functions', async () => {
    const message = await syncMessage()
    const cloned = structuredClone(message)

    expect(isParentToRuntimeHostMessage(cloned)).toBe(true)
    expect(cloned.compilation).toEqual(message.compilation)
    expect(cloned.compilation.page.nodesById).not.toBe(message.compilation.page.nodesById)
  })

  it('rejects stale, future, missing, and mixed compilation contracts', async () => {
    const message = await syncMessage()
    const withKey = (key: Record<string, unknown>) => ({
      ...message,
      compilation: { ...message.compilation, key },
    })

    expect(isParentToRuntimeHostMessage(withKey({
      ...message.compilation.key,
      irVersion: CANONICAL_PROJECT_IR_VERSION - 1,
    }))).toBe(false)
    expect(isParentToRuntimeHostMessage(withKey({
      ...message.compilation.key,
      irVersion: CANONICAL_PROJECT_IR_VERSION + 1,
    }))).toBe(false)
    expect(isParentToRuntimeHostMessage(withKey({
      ...message.compilation.key,
      irVersion: undefined,
    }))).toBe(false)
    expect(isParentToRuntimeHostMessage(withKey({
      ...message.compilation.key,
      compilerVersion: '4.0.0',
    }))).toBe(false)
    expect(isParentToRuntimeHostMessage(withKey({
      ...message.compilation.key,
      compilerVersion: `${CONFIG_FORM_COMPILER_VERSION}-future`,
    }))).toBe(false)
    expect(isParentToRuntimeHostMessage(withKey({
      ...message.compilation.key,
      compilerVersion: undefined,
    }))).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      compilation: {
        ...message.compilation,
        page: { ...message.compilation.page, flows: [] },
      },
    })).toBe(false)

    const [nodeId] = Object.keys(message.compilation.page.nodesById)
    const node = nodeId ? message.compilation.page.nodesById[nodeId] : undefined
    expect(node).toBeDefined()
    expect(isParentToRuntimeHostMessage({
      ...message,
      compilation: {
        ...message.compilation,
        page: {
          ...message.compilation.page,
          nodesById: {
            ...message.compilation.page.nodesById,
            [nodeId!]: { ...node, events: {} },
          },
        },
      },
    })).toBe(false)
  })

  it('rejects stale, future, and missing outer protocol versions', async () => {
    const message = await syncMessage()
    const child = childMessage(message, { type: 'ready' })

    for (const version of [
      RUNTIME_HOST_PROTOCOL_VERSION - 1,
      RUNTIME_HOST_PROTOCOL_VERSION + 1,
      undefined,
    ]) {
      expect(isParentToRuntimeHostMessage({ ...message, version })).toBe(false)
      expect(isRuntimeHostToParentMessage({ ...child, version })).toBe(false)
    }
  })

  it('accepts design canvas and drag-visual syncs only with a complete design contract', async () => {
    const message = await designSyncMessage()

    expect(isParentToRuntimeHostMessage(structuredClone(message))).toBe(true)
    expect(isParentToRuntimeHostMessage({
      ...message,
      design: { ...message.design!, variant: 'drag-visual' },
    })).toBe(true)
    expect(isParentToRuntimeHostMessage({ ...message, design: undefined })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      design: { ...message.design!, candidateId: '' },
    })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      design: { ...message.design!, canvasWidth: -1 },
    })).toBe(false)
  })

  it('validates geometry payloads from the design RuntimeHost', async () => {
    const message = await designSyncMessage()
    const geometry = childMessage(message, {
      type: 'geometry',
      payload: {
        layoutRect: rect,
        nodes: [{ depth: 1, nodeId: 'name-node', order: 0, path: 'fields.0', rect, slot: 'default' }],
        surfaceRect: rect,
        viewport: { height: 480, width: 900 },
      },
    })

    expect(isRuntimeHostToParentMessage(geometry)).toBe(true)
    expect(isRuntimeHostToParentMessage({
      ...geometry,
      payload: { ...(geometry.payload as object), surfaceRect: { ...rect, width: -1 } },
    })).toBe(false)
    expect(isRuntimeHostToParentMessage({
      ...geometry,
      payload: { ...(geometry.payload as object), surfaceRect: { ...rect, right: Number.POSITIVE_INFINITY } },
    })).toBe(false)
    expect(isRuntimeHostToParentMessage({
      ...geometry,
      payload: { ...(geometry.payload as object), viewport: { height: -1, width: 900 } },
    })).toBe(false)
  })

  it('validates every design pointer lifecycle message and rejects malformed pointers', async () => {
    const message = await designSyncMessage()
    const payload = {
      button: 0,
      clientX: 120,
      clientY: 48,
      ctrlKey: false,
      metaKey: false,
      nodeId: 'name-node',
      pointerId: 7,
      shiftKey: false,
    }

    for (const type of ['designPointerDown', 'designPointerMove', 'designPointerUp', 'designPointerCancel'])
      expect(isRuntimeHostToParentMessage(childMessage(message, { type, payload }))).toBe(true)

    expect(isRuntimeHostToParentMessage(childMessage(message, {
      type: 'designPointerMove',
      payload: { ...payload, clientX: Number.NaN },
    }))).toBe(false)
    expect(isRuntimeHostToParentMessage(childMessage(message, {
      type: 'designPointerUp',
      payload: { ...payload, pointerId: -1 },
    }))).toBe(false)
    expect(isRuntimeHostToParentMessage(childMessage(message, {
      type: 'designPointerCancel',
      payload: { ...payload, nodeId: '' },
    }))).toBe(false)
  })

  it('rejects malformed adapters and page identities', async () => {
    const message = await syncMessage()
    expect(isParentToRuntimeHostMessage({ ...message, adapter: 'unknown' })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      compilation: {
        ...message.compilation,
        page: { ...message.compilation.page, id: 'other-page' },
      },
    })).toBe(false)
  })

  it('validates atomic runtime state and rejects mixed host identities', async () => {
    const message = await syncMessage()
    expect(isParentToRuntimeHostMessage({
      ...message,
      runtimeState: { fields: flatFields('name'), values: { name: 'Ada' }, touched: ['name'], validation: { name: ['Required'] } },
    })).toBe(true)
    expect(isParentToRuntimeHostMessage({
      ...message,
      projectId: 'other-project',
    })).toBe(false)
    expect(isParentToRuntimeHostMessage({
      ...message,
      runtimeState: { fields: flatFields(), values: {}, touched: [1], validation: {} },
    })).toBe(false)
    expect(isRuntimeHostToParentMessage(childMessage(message, {
      type: 'runtimeState',
      payload: { fields: flatFields('name'), values: { name: 'Lin' }, touched: ['name'], validation: { name: [] } },
    }))).toBe(true)
  })

  it('validates success and invalid submit results as one atomic payload', async () => {
    const message = await syncMessage()
    const base = childMessage(message, {
      type: 'submitResult',
      payload: { fields: flatFields('name'), requestId: 'submit-1', status: 'success', values: { name: 'Ada' }, touched: ['name'], validation: {} },
    })

    expect(isRuntimeHostToParentMessage(structuredClone(base))).toBe(true)
    expect(isRuntimeHostToParentMessage({
      ...base,
      payload: { ...(base.payload as object), status: 'invalid', validation: { name: ['Required'] } },
    })).toBe(true)
    expect(isRuntimeHostToParentMessage({
      ...base,
      payload: { ...(base.payload as object), status: 'pending' },
    })).toBe(false)
    expect(isRuntimeHostToParentMessage({
      ...base,
      payload: { ...(base.payload as object), touched: [''] },
    })).toBe(false)
    expect(isParentToRuntimeHostMessage(childMessage(message, { type: 'submit' }))).toBe(false)
    expect(isParentToRuntimeHostMessage(childMessage(message, { type: 'submit', requestId: 'submit-1' }))).toBe(true)
    expect(isRuntimeHostToParentMessage(childMessage(message, { type: 'submit', values: {} }))).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...base, payload: { ...(base.payload as object), requestId: undefined } })).toBe(false)
  })

  it('accepts messages only from the expected source, origin, and session', async () => {
    const message = await syncMessage()
    const source = {} as MessageEventSource
    const otherSource = {} as MessageEventSource
    const event = {
      data: message,
      origin: 'https://workbench.test',
      source,
    } as MessageEvent<unknown>

    expect(acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: 'https://workbench.test',
      hostId: message.hostId,
      projectId: message.projectId,
      pageId: message.pageId,
      revision: message.revision,
      source,
    })).toBe(message)
    expect(acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: 'https://workbench.test',
      hostId: message.hostId,
      projectId: message.projectId,
      pageId: message.pageId,
      revision: 'stale-revision',
      source,
    })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: 'https://other.test',
      hostId: message.hostId,
      source,
    })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: 'https://workbench.test',
      hostId: 'other-session',
      source,
    })).toBeUndefined()
    expect(acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: 'https://workbench.test',
      hostId: message.hostId,
      source: otherSource,
    })).toBeUndefined()
  })
  it('requires a bounded JSON-safe instance directory and exact instance-key meta references', async () => {
    const message = await syncMessage()
    const field = { nodeId: 'name-node', scope: [{ scopeId: 'rows', rowId: 'row-1' }], instanceKey: 'opaque-key', valuePath: ['rows', 0, 'a.b'] }
    const state = { fields: [field], values: { rows: [{ 'a.b': 'value' }] }, touched: ['opaque-key'], validation: { 'opaque-key': ['Required'] } }
    const accepts = (payload: unknown) => isRuntimeHostToParentMessage(childMessage(message, { type: 'runtimeState', payload }))
    expect(accepts(state)).toBe(true)
    expect(accepts({ fields: [], values: {}, touched: [], validation: {} })).toBe(true)
    expect(accepts({ ...state, fields: undefined })).toBe(false)
    expect(accepts({ ...state, fields: [field, field] })).toBe(false)
    expect(accepts({ ...state, touched: ['a.b'] })).toBe(false)
    expect(accepts({ ...state, validation: { 'a.b': ['Required'] } })).toBe(false)
    for (const override of [
      { nodeId: '__proto__' },
      { instanceKey: 'constructor' },
      { scope: [{ scopeId: 'rows', rowId: '' }] },
      { scope: [field.scope[0], field.scope[0]] },
      { valuePath: ['rows', -1, 'a.b'] },
      { valuePath: ['rows', 5, 'a.b'] },
      { valuePath: ['rows', '0', 'a.b'] },
      { valuePath: ['__proto__', 'polluted'] },
      { valuePath: Array.from({ length: 66 }).fill('a') },
      { scope: Array.from({ length: 33 }, (_, i) => ({ scopeId: `s${i}`, rowId: 'r' })) },
    ])
      expect(accepts({ ...state, fields: [{ ...field, ...override }] })).toBe(false)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const sparseAndExtra = [] as unknown[]
    sparseAndExtra[1] = 1
    ;(sparseAndExtra as unknown as Record<string, unknown>).extra = 1
    const denseAndExtra = [1] as unknown as Record<string, unknown>
    denseAndExtra.extra = 1
    for (const values of [cyclic, { bad: Number.NaN }, { bad: new Date() }, JSON.parse('{"__proto__":{"bad":1}}'), sparseAndExtra, denseAndExtra, { huge: Array.from({ length: 10_001 }).fill(1) }])
      expect(accepts({ ...state, values })).toBe(false)
    expect(accepts({ ...state, validation: { 'opaque-key': Array.from({ length: 129 }).fill('error') } })).toBe(false)
    expect(accepts({ ...state, fields: [{ ...field, scope: [] }] })).toBe(false)
    expect(accepts({ ...state, values: { rows: [{ 'a.b': 1 }, { other: 2 }] }, fields: [field, { ...field, nodeId: 'other', instanceKey: 'other-key', valuePath: ['rows', 1, 'other'] }] })).toBe(false)
    expect(accepts({ fields: [], values: { sparse: Array.from({ length: 10_001 }) }, touched: [], validation: {} })).toBe(false)
    let deep: unknown = 1
    for (let depth = 0; depth < 66; depth += 1)
      deep = { nested: deep }
    expect(accepts({ fields: [], values: { deep }, touched: [], validation: {} })).toBe(false)
  })
})

function flatFields(...names: string[]) {
  return names.map(nodeId => ({ nodeId, scope: [], instanceKey: nodeId, valuePath: [nodeId] }))
}
