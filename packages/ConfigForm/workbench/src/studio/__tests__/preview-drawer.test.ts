// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { PreviewDrawer } from '..'

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

function mountPreviewDrawer(componentProps: Record<string, unknown>): {
  root: DOMWrapper<Element>
  target: HTMLElement
  wrapper: VueWrapper
} {
  const target = document.createElement('main')
  target.id = 'workbench-overlays'
  target.className = 'workbench-overlays'
  target.dataset.theme = 'dark'
  document.body.append(target)
  const wrapper = mount(PreviewDrawer as Component, {
    props: componentProps,
    global: { stubs: { PreviewRuntimeHostFrame: RuntimeStub } },
  })
  return { root: new DOMWrapper(target), target, wrapper }
}

describe('preview drawer', () => {
  it('renders the revision-bound submission result and exposes clear action', async () => {
    const { root, target, wrapper } = mountPreviewDrawer({
      ...props(),
      lastSubmission: {
        status: 'invalid',
        values: { name: '' },
        touched: ['name'],
        validation: { name: ['Required'] },
        revisionKey: 'project:home:1',
        submittedAt: 1,
      },
    })

    await flushPromises()

    expect(root.get('[data-preview-results]').text()).toContain('Validation failed')
    expect(root.get('[data-preview-submission-json]').text()).toContain('"name": ""')
    expect(root.text()).toContain('Required')
    expect(root.get('[role="complementary"]').attributes('aria-label')).toBe('Page preview')

    await root.get('[data-preview-results] button[aria-label="Clear submission result"]').trigger('click')
    expect(wrapper.emitted('clearSubmission')).toEqual([[]])

    await wrapper.setProps({ expanded: true })
    await nextTick()
    expect(root.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    wrapper.unmount()
    target.remove()
  })

  it('keeps the empty state usable before the first submission', async () => {
    const { root, target, wrapper } = mountPreviewDrawer(props())

    await flushPromises()

    expect(root.get('[data-preview-results]').text()).toContain('Submit the preview form')
    expect(root.find('[data-runtime-stub]').exists()).toBe(true)
    expect(root.findAll('[data-command-hint]')).toHaveLength(6)
    const submit = root.get('button[aria-label="Submit preview form"]')
    expect(submit.attributes('aria-disabled')).toBe('true')
    expect(submit.attributes('data-command-disabled-reason')).toBe('Preview is not ready to submit')
    expect(submit.attributes('disabled')).toBeUndefined()

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(root.find('[data-runtime-stub]').exists()).toBe(false)
    wrapper.unmount()
    target.remove()
  })

  it('restores the opening trigger after compact Preview closes', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    const { target, wrapper } = mountPreviewDrawer({ ...props(), open: false })
    trigger.focus()

    await wrapper.setProps({ open: true })
    await flushPromises()
    target.querySelector<HTMLButtonElement>('button[aria-label="Close preview"]')?.focus()
    await wrapper.setProps({ open: false })
    await flushPromises()

    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
    target.remove()
    trigger.remove()
  })
})
