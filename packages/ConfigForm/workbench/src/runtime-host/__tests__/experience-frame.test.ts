// @vitest-environment happy-dom

import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { initializePrototypeProjectSession } from '@moluoxixi/config-form-prototype-runtime/session'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PreviewRuntimeHostFrame from '../../app/components/PreviewRuntimeHostFrame/index.vue'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '..'
import { createExperienceCompilerFixture } from './compiler-fixture'

const hostId = '11111111-1111-4111-8111-111111111111'

afterEach(() => vi.restoreAllMocks())

function fixture() {
  const compiled = compileCanonicalProject(createExperienceCompilerFixture(4))
  if (!compiled.success)
    throw new Error(compiled.diagnostics[0]?.message ?? 'Experience compilation failed')
  let nextRow = 0
  const initialized = initializePrototypeProjectSession({
    compilation: compiled.compilation,
    homeInstanceId: 'page-1',
    createRowId: () => `row-${++nextRow}`,
  })
  if (!initialized.success)
    throw new Error(initialized.diagnostics[0]?.message ?? 'Experience session failed')
  return { compilation: compiled.compilation, session: initialized.data }
}

describe('Experience Runtime Host frame', () => {
  it('suppresses a child session echo and rejects stale or non-live instance state', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const current = fixture()
    const wrapper = mount(PreviewRuntimeHostFrame, {
      props: {
        adapter: 'element-plus',
        compilation: current.compilation,
        locale: 'en-US',
        revision: 'revision-1',
        session: current.session,
        sessionId: 'experience-1',
        title: 'Experience',
      },
    })
    const postMessage = vi.fn()
    const source = { postMessage } as unknown as Window
    Object.defineProperty(wrapper.get('iframe').element, 'contentWindow', {
      configurable: true,
      value: source,
    })
    await wrapper.get('iframe').trigger('load')

    const child = (payload: Record<string, unknown>, sequence: number) => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          channel: RUNTIME_HOST_CHANNEL,
          version: RUNTIME_HOST_PROTOCOL_VERSION,
          hostId,
          projectId: 'project',
          revision: 'revision-1',
          sequence,
          ...payload,
        },
        origin: window.location.origin,
        source,
      }))
    }
    child({
      type: 'experience.session',
      sessionId: 'experience-1',
      transition: { session: current.session, diagnostics: [] },
    }, 1)
    await nextTick()
    expect(wrapper.emitted('session')).toHaveLength(1)

    await wrapper.setProps({ session: structuredClone(current.session) })
    expect(postMessage.mock.calls.filter(([message]) => (
      message as { type?: string }
    ).type === 'experience.sync')).toHaveLength(1)

    const state = {
      fields: [],
      touched: [],
      validation: {},
      values: {},
      surfaceId: 'home',
      stateRevision: 1,
      projection: [],
    }
    child({
      type: 'experience.instanceState',
      sessionId: 'experience-1',
      instanceId: 'page-1',
      payload: state,
    }, 2)
    child({
      type: 'experience.instanceState',
      sessionId: 'experience-1',
      instanceId: 'page-1',
      payload: state,
    }, 3)
    child({
      type: 'experience.instanceState',
      sessionId: 'experience-1',
      instanceId: 'closed-instance',
      payload: { ...state, stateRevision: 2 },
    }, 4)
    await nextTick()
    expect(wrapper.emitted('instanceState')).toHaveLength(1)

    await wrapper.setProps({ revision: 'revision-2' })
    expect(postMessage.mock.calls.filter(([message]) => (
      message as { type?: string }
    ).type === 'experience.sync')).toHaveLength(2)
    wrapper.unmount()
  })
})
