import type { ProjectCoordinationPort } from '../project-coordination-channel'
import { describe, expect, it, vi } from 'vitest'
import { createProjectCoordinationChannel } from '../project-coordination-channel'

class PortHub {
  private readonly listeners = new Set<(message: unknown) => void>()

  createPort(): ProjectCoordinationPort {
    return {
      close: () => {},
      post: message => this.listeners.forEach(listener => listener(structuredClone(message))),
      subscribe: (listener) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
      },
    }
  }
}

describe('projectCoordinationChannel', () => {
  it('publishes monotonic revisions and ignores duplicates, stale messages, and self messages', () => {
    const hub = new PortHub()
    const first = createProjectCoordinationChannel({
      now: () => '2026-08-31T12:00:00.000Z',
      port: hub.createPort(),
      projectId: 'project',
      sessionId: 'first',
    })
    const second = createProjectCoordinationChannel({
      port: hub.createPort(),
      projectId: 'project',
      sessionId: 'second',
    })
    const listener = vi.fn()
    second.subscribeRevision(listener)

    first.publishRevision(1)
    first.publishRevision(2)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
      repositoryRevision: 2,
      sequence: 2,
      sourceSessionId: 'first',
    }))

    first.close()
    second.close()
  })

  it('reports an active owner without transferring project data', async () => {
    const hub = new PortHub()
    const first = createProjectCoordinationChannel({
      createId: () => 'presence-1',
      port: hub.createPort(),
      projectId: 'project',
      sessionId: 'first',
    })
    const second = createProjectCoordinationChannel({
      port: hub.createPort(),
      projectId: 'project',
      sessionId: 'second',
    })

    await expect(second.queryPresence('first', 10)).resolves.toBe('active')
    first.close()
    await expect(second.queryPresence('first', 1)).resolves.toBe('inactive')
    second.close()
  })

  it('remains correct when the coordination transport is unavailable', async () => {
    const original = globalThis.BroadcastChannel
    vi.stubGlobal('BroadcastChannel', undefined)
    try {
      const channel = createProjectCoordinationChannel({
        projectId: 'project',
        sessionId: 'session',
      })
      expect(channel.available).toBe(false)
      channel.publishRevision(1)
      await expect(channel.queryPresence('another', 1)).resolves.toBe('unknown')
      channel.close()
    }
    finally {
      vi.stubGlobal('BroadcastChannel', original)
    }
  })
})
