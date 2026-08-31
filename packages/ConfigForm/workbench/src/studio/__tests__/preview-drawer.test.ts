// @vitest-environment happy-dom

import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import PreviewDrawer from '../PreviewDrawer.vue'

const RuntimeStub = defineComponent({
  name: 'PreviewRuntimeHostFrameStub',
  setup(_, { expose }) {
    expose({ submit: vi.fn() })
    return () => h('div', { 'data-runtime-stub': '' })
  },
})

function props() {
  return {
    adapter: 'element-plus' as const,
    compilation: {} as never,
    expanded: false,
    open: true,
    projection: {
      current: {
        pageId: 'home',
        projectId: 'project',
        revisionKey: 'project:home:1',
        runtimeSessionKey: 'session',
      },
      compileResult: { success: true, diagnostics: [] },
    } as never,
    reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
    runtimeState: { values: {}, touched: [], validation: {} },
    state: { label: 'Live', tone: 'live' as const },
    viewport: 'desktop' as const,
  }
}

describe('preview drawer', () => {
  it('renders the revision-bound submission result and exposes clear action', async () => {
    const wrapper = mount(PreviewDrawer as Component, {
      props: {
        ...props(),
        lastSubmission: {
          status: 'invalid',
          values: { name: '' },
          touched: ['name'],
          validation: { name: ['Required'] },
          revisionKey: 'project:home:1',
          submittedAt: 1,
        },
      },
      global: { stubs: { PreviewRuntimeHostFrame: RuntimeStub } },
    })

    expect(wrapper.get('[data-preview-results]').text()).toContain('Validation failed')
    expect(wrapper.get('[data-preview-submission-json]').text()).toContain('"name": ""')
    expect(wrapper.text()).toContain('Required')

    await wrapper.get('[data-preview-results] button[aria-label="Clear submission result"]').trigger('click')
    expect(wrapper.emitted('clearSubmission')).toEqual([[]])

    await wrapper.setProps({ expanded: true })
    await nextTick()
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    wrapper.unmount()
  })

  it('keeps the empty state usable before the first submission', () => {
    const wrapper = mount(PreviewDrawer as Component, {
      props: props(),
      global: { stubs: { PreviewRuntimeHostFrame: RuntimeStub } },
    })

    expect(wrapper.get('[data-preview-results]').text()).toContain('Submit the preview form')
    wrapper.unmount()
  })
})
