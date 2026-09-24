import type { ExperienceRuntimeHostIdentityEvent } from '../../runtime-host'
import { describe, expect, it } from 'vitest'
import { createPreviewSession, createWorkbenchPreviewSession } from '../services/preview'
import {
  compilePreviewFixture,
  previewSessionFixture,
  previewStateFixture,
} from './preview-instance-fixture'

function mount(
  session: ReturnType<typeof createPreviewSession>,
  identity: ExperienceRuntimeHostIdentityEvent,
): void {
  session.handleRuntimeMounted(identity)
  session.handleRuntimeReady(identity)
}

describe('experience preview session', () => {
  it('accepts one ProjectCompilation and Prototype Session identity', () => {
    const fixture = compilePreviewFixture()
    const session = createWorkbenchPreviewSession()

    session.accept(fixture.input)

    expect(session.compilation.value).toBe(fixture.compilation)
    expect(session.session.value).toEqual(fixture.session)
    expect(session.revision.value).toBe('revision-1')
    expect(session.sessionId.value).toBe('session-1')
    expect(session.mounted.value).toBe(false)
    expect(session.ready.value).toBe(false)
  })

  it('rejects an invalid or cross-project initial session', () => {
    const fixture = compilePreviewFixture()
    const session = createPreviewSession()

    expect(() => session.accept({ ...fixture.input, revision: '' })).toThrow('revision')
    expect(() => session.accept({
      ...fixture.input,
      session: { ...fixture.session, projectId: 'other-project' },
    })).toThrow('same project')
    expect(() => session.accept({
      ...fixture.input,
      session: {
        ...fixture.session,
        pageHistory: [],
        instancesById: {},
      },
    })).toThrow('valid Prototype Session')
  })

  it('establishes mounted and ready only for the current identity', () => {
    const fixture = compilePreviewFixture()
    const session = createPreviewSession()
    session.accept(fixture.input)
    const current = fixture.identity()

    session.handleRuntimeMounted({ ...current, revision: 'stale' })
    session.handleRuntimeMounted({ ...current, sessionId: 'stale' })
    session.handleRuntimeReady(current)
    expect(session.activeHost.value).toBeUndefined()
    expect(session.ready.value).toBe(false)

    session.handleRuntimeMounted(current)
    expect(session.mounted.value).toBe(true)
    expect(session.ready.value).toBe(false)
    session.handleRuntimeReady(current)
    expect(session.ready.value).toBe(true)
  })

  it('retires a replaced host and ignores all of its later messages', () => {
    const fixture = compilePreviewFixture()
    const session = createPreviewSession()
    session.accept(fixture.input)
    const first = fixture.identity('host-1')
    const replacement = fixture.identity('host-2')
    mount(session, first)
    session.handleInstanceState({ ...first, instanceId: 'page-1', payload: previewStateFixture('page-1', 1, 'first') })

    mount(session, replacement)
    session.handleInstanceState({ ...first, instanceId: 'page-1', payload: previewStateFixture('page-1', 2, 'stale') })
    session.handleRuntimeMounted(first)

    expect(session.activeHost.value?.hostId).toBe('host-2')
    expect(session.getInstanceState('page-1')?.values).toEqual({ name: 'first' })
    session.handleInstanceState({ ...replacement, instanceId: 'page-1', payload: previewStateFixture('page-1', 2, 'replacement') })
    expect(session.getInstanceState('page-1')?.values).toEqual({ name: 'replacement' })
  })

  it('updates the Prototype Session and removes state for closed instances', () => {
    const open = previewSessionFixture(['page-1', 'page-2'])
    const fixture = compilePreviewFixture(open)
    const session = createPreviewSession()
    session.accept(fixture.input)
    const identity = fixture.identity()
    mount(session, identity)
    session.handleInstanceState({ ...identity, instanceId: 'page-1', payload: previewStateFixture('page-1') })
    session.handleInstanceState({ ...identity, instanceId: 'page-2', payload: previewStateFixture('page-2') })

    const closed = previewSessionFixture(['page-1'], { 'page-1': 'kept' })
    session.handleSession({
      ...identity,
      transition: {
        session: closed,
        diagnostics: [{ code: 'notice', message: 'transitioned' }],
      },
    })

    expect(session.session.value).toEqual(closed)
    expect(session.diagnostics.value).toEqual([{ code: 'notice', message: 'transitioned' }])
    expect(Object.keys(session.instanceStates.value)).toEqual(['page-1'])
    session.handleInstanceState({ ...identity, instanceId: 'page-2', payload: previewStateFixture('page-2', 2) })
    expect(session.getInstanceState('page-2')).toBeUndefined()
  })

  it('isolates repeated Surface instances and enforces per-instance revisions', () => {
    const fixture = compilePreviewFixture(previewSessionFixture(['page-1', 'page-2']))
    const session = createPreviewSession()
    session.accept(fixture.input)
    const identity = fixture.identity()
    mount(session, identity)

    session.handleInstanceState({ ...identity, instanceId: 'page-1', payload: previewStateFixture('page-1', 2, 'one') })
    session.handleInstanceState({ ...identity, instanceId: 'page-2', payload: previewStateFixture('page-2', 1, 'two') })
    session.handleInstanceState({ ...identity, instanceId: 'page-1', payload: previewStateFixture('page-1', 1, 'stale') })

    expect(session.getInstanceState('page-1')?.values).toEqual({ name: 'one' })
    expect(session.getInstanceState('page-2')?.values).toEqual({ name: 'two' })
  })

  it('resets host state when the accepted revision changes', () => {
    const fixture = compilePreviewFixture()
    const session = createPreviewSession()
    session.accept(fixture.input)
    const identity = fixture.identity()
    mount(session, identity)
    session.handleInstanceState({ ...identity, instanceId: 'page-1', payload: previewStateFixture('page-1') })

    session.accept({ ...fixture.input, revision: 'revision-2' })

    expect(session.activeHost.value).toBeUndefined()
    expect(session.mounted.value).toBe(false)
    expect(session.ready.value).toBe(false)
    expect(session.instanceStates.value).toEqual({})
  })

  it('clears runtime errors and ignores every operation after disposal', () => {
    const fixture = compilePreviewFixture()
    const session = createPreviewSession()
    session.accept(fixture.input)
    mount(session, fixture.identity())
    session.handleRuntimeError('render failed')
    expect(session.error.value?.message).toBe('render failed')
    expect(session.ready.value).toBe(false)

    session.dispose()
    session.accept(fixture.input)
    mount(session, fixture.identity())

    expect(session.compilation.value).toBeUndefined()
    expect(session.activeHost.value).toBeUndefined()
    expect(session.error.value).toBeUndefined()
  })

  it('does not expose legacy event forwarding or submission APIs', () => {
    const session = createPreviewSession()

    expect('handleFieldChange' in session).toBe(false)
    expect('handleRuntimeState' in session).toBe(false)
    expect('handleSubmit' in session).toBe(false)
    expect('handleSubmitResult' in session).toBe(false)
    expect('lastSubmission' in session).toBe(false)
  })
})
