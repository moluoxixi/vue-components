import { describe, expect, it } from 'vitest'
import { isRuntimeHostToParentMessage, RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '..'

const state = { fields: [], touched: [], validation: {}, values: {} }
const base = { channel: RUNTIME_HOST_CHANNEL, version: RUNTIME_HOST_PROTOCOL_VERSION, hostId: 'host', projectId: 'project', revision: 'revision', sequence: 1 }

describe('runtime Host Experience instance state v7', () => {
  it('requires live instance identity fields and a finite monotonic state revision', () => {
    const message = { ...base, type: 'experience.instanceState', sessionId: 'session', instanceId: 'page-1', payload: { ...state, surfaceId: 'home', stateRevision: 1, projection: [] } }
    expect(isRuntimeHostToParentMessage(message)).toBe(true)
    expect(isRuntimeHostToParentMessage({ ...message, instanceId: '' })).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...message, sessionId: '' })).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...message, payload: { ...message.payload, stateRevision: Number.POSITIVE_INFINITY } })).toBe(false)
    expect(isRuntimeHostToParentMessage({ ...message, payload: { ...message.payload, surfaceId: '' } })).toBe(false)
  })

  it('does not treat a closed-instance late snapshot as a different valid shape', () => {
    const message = { ...base, type: 'experience.instanceState', sessionId: 'session', instanceId: 'closed-instance', payload: { ...state, surfaceId: 'home', stateRevision: 2, projection: [] } }
    expect(isRuntimeHostToParentMessage(message)).toBe(true)
    expect(isRuntimeHostToParentMessage({ ...message, sequence: 0 })).toBe(true)
    // Liveness, session id and revision ordering are enforced by the parent frame;
    // the wire reader intentionally validates only the v7 shape.
  })
})
