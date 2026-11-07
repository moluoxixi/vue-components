// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { PreviewWorkspace } from '../../app'

const RuntimeStub = defineComponent({
  name: 'PreviewRuntimeHostFrameStub',
  emits: ['error', 'instanceState', 'mounted', 'ready', 'session'],
  setup: () => () => h('div', { 'data-runtime-stub': '' }),
})

function props() {
  return {
    adapter: 'element-plus' as const,
    compilation: {} as never,
    open: true,
    revision: 'revision-1',
    session: {} as never,
    sessionId: 'session-1',
    state: { label: 'Live', tone: 'live' as const },
    viewport: 'desktop' as const,
  }
}

function mountPreviewWorkspace(componentProps: Record<string, unknown>): {
  root: DOMWrapper<Element>
  target: HTMLElement
  wrapper: VueWrapper
} {
  const target = document.createElement('main')
  target.id = 'workbench-overlays'
  target.className = 'workbench-overlays'
  target.dataset.theme = 'dark'
  document.body.append(target)
  const wrapper = mount(PreviewWorkspace as Component, {
    attachTo: target,
    props: componentProps,
    global: { stubs: { PreviewRuntimeHostFrame: RuntimeStub } },
  })
  return { root: new DOMWrapper(target), target, wrapper }
}

describe('preview workspace', () => {
  it('renders the revision-bound Experience host and accepts ready only for its current identity', async () => {
    const { root, target, wrapper } = mountPreviewWorkspace(props())

    await flushPromises()

    expect(root.find('[data-runtime-stub]').exists()).toBe(true)
    expect(root.get('[role="complementary"]').attributes('aria-label')).toBe('Page preview')
    const runtime = wrapper.findComponent(RuntimeStub)
    expect(runtime.attributes('breakpoint')).toBe('desktop')
    const identity = {
      hostId: 'host-1',
      projectId: 'project',
      revision: 'revision-1',
      sessionId: 'session-1',
    }
    runtime.vm.$emit('ready', { ...identity, revision: 'stale' })
    expect(wrapper.emitted('ready')).toBeUndefined()
    runtime.vm.$emit('ready', identity)
    expect(wrapper.emitted('ready')).toEqual([[identity]])

    wrapper.unmount()
    target.remove()
  })

  it('presents Preview as an inline workspace without a modal focus trap', async () => {
    const { root, target, wrapper } = mountPreviewWorkspace(props())

    await flushPromises()

    expect(root.find('.preview-workspace').exists()).toBe(true)
    expect(root.find('[role="dialog"]').exists()).toBe(false)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    root.get('.preview-toolbar button:last-child').element.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    expect(root.get('[role="complementary"]').attributes('aria-label')).toBe('Page preview')
    expect(root.find('[data-preview-results]').exists()).toBe(false)
    expect(root.find('[data-runtime-stub]').exists()).toBe(true)

    wrapper.unmount()
    target.remove()
  })

  it('shows an unavailable state until all Experience inputs exist', async () => {
    const { root, target, wrapper } = mountPreviewWorkspace({ ...props(), session: undefined })

    await flushPromises()

    expect(root.get('.preview-errors').text()).toContain('Preview unavailable')
    expect(root.find('[data-runtime-stub]').exists()).toBe(false)

    await wrapper.setProps({ session: {} as never })
    await nextTick()
    expect(root.find('[data-runtime-stub]').exists()).toBe(true)

    await wrapper.setProps({ open: false })
    await nextTick()
    expect(root.find('[data-runtime-stub]').exists()).toBe(false)
    wrapper.unmount()
    target.remove()
  })

  it('keeps the runtime mounted while the embedded preview is resized', async () => {
    const { root, target, wrapper } = mountPreviewWorkspace(props())
    await flushPromises()
    const runtime = root.get('[data-runtime-stub]').element
    await wrapper.setProps({ viewport: 'mobile' })
    expect(root.get('[data-runtime-stub]').element).toBe(runtime)
    wrapper.unmount()
    target.remove()
  })
})
