import { describe, expect, it } from 'vitest'
import {
  emptyPreviewInstanceStates,
  retainLivePreviewInstanceStates,
  updatePreviewInstanceState,
} from '../../services/preview-instance-state'
import { previewSessionFixture, previewStateFixture } from './preview-instance-fixture'

describe('preview instance state', () => {
  it('stores a cloned state only for a live matching instance', () => {
    const session = previewSessionFixture(['page-1'])
    const initial = emptyPreviewInstanceStates()
    const payload = previewStateFixture('page-1', 1, 'Ada')

    const next = updatePreviewInstanceState(initial, session, 'page-1', payload)

    expect(next).not.toBe(initial)
    expect(next['page-1']).toEqual(payload)
    expect(next['page-1']).not.toBe(payload)
    expect(updatePreviewInstanceState(next, session, 'closed', payload)).toBe(next)
    expect(updatePreviewInstanceState(next, session, 'page-1', { ...payload, surfaceId: 'missing' })).toBe(next)
  })

  it('rejects repeated, decreasing, and invalid revisions', () => {
    const session = previewSessionFixture(['page-1'])
    const current = updatePreviewInstanceState(
      emptyPreviewInstanceStates(),
      session,
      'page-1',
      previewStateFixture('page-1', 2),
    )

    expect(updatePreviewInstanceState(current, session, 'page-1', previewStateFixture('page-1', 2))).toBe(current)
    expect(updatePreviewInstanceState(current, session, 'page-1', previewStateFixture('page-1', 1))).toBe(current)
    expect(updatePreviewInstanceState(current, session, 'page-1', previewStateFixture('page-1', -1))).toBe(current)
  })

  it('retains only states for live instances on the same Surface', () => {
    const open = previewSessionFixture(['page-1', 'page-2'])
    const first = updatePreviewInstanceState(
      emptyPreviewInstanceStates(),
      open,
      'page-1',
      previewStateFixture('page-1'),
    )
    const both = updatePreviewInstanceState(first, open, 'page-2', previewStateFixture('page-2'))
    const closed = previewSessionFixture(['page-1'])

    expect(Object.keys(retainLivePreviewInstanceStates(both, closed))).toEqual(['page-1'])
    expect(retainLivePreviewInstanceStates({
      ...both,
      'page-1': { ...both['page-1']!, surfaceId: 'missing' },
    }, closed)).toEqual({})
  })
})
