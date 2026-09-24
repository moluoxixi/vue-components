// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { PreviewDrawer } from '../../app'

const RuntimeStub = defineComponent({
  name: 'PreviewRuntimeHostFrameStub',
  emits: ['error', 'instanceState', 'mounted', 'ready', 'session'],
  setup: () => () => h('div', { 'data-runtime-stub': '' }),
})

function props() {
  return {
    adapter: 'element-plus' as const,
    compilation: {} as never,
    expanded: false,
    open: true,
    revision: 'revision-1',
    session: {} as never,
    sessionId: 'session-1',
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
  it('renders the revision-bound Experience host and accepts ready only for its current identity', async () => {
    const { root, target, wrapper } = mountPreviewDrawer(props())

    await flushPromises()

    expect(root.find('[data-runtime-stub]').exists()).toBe(true)
    expect(root.get('[role="complementary"]').attributes('aria-label')).toBe('Surface preview')
    const runtime = wrapper.findComponent(RuntimeStub)
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

    await wrapper.setProps({ expanded: true })
    await nextTick()
    expect(root.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    wrapper.unmount()
    target.remove()
  })

  it('presents Preview as one centered modal without the removed submission panel', async () => {
    const { root, target, wrapper } = mountPreviewDrawer(props())

    await flushPromises()

    expect(root.find('.preview-dialog-shell').exists()).toBe(true)
    expect(root.find('.el-drawer').exists()).toBe(false)
    expect(root.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(root.find('[data-preview-results]').exists()).toBe(false)
    expect(root.find('[data-runtime-stub]').exists()).toBe(true)

    wrapper.unmount()
    target.remove()
  })

  it('shows an unavailable state until all Experience inputs exist', async () => {
    const { root, target, wrapper } = mountPreviewDrawer({ ...props(), session: undefined })

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

  it('collapses fullscreen through the dialog close guard without destroying its content', async () => {
    const { root, target, wrapper } = mountPreviewDrawer({ ...props(), expanded: true })
    await flushPromises()
    const runtime = root.get('[data-runtime-stub]').element
    const done = vi.fn()
    const dialog = wrapper.findComponent({ name: 'ElDialog' })
    dialog.props('beforeClose')(done)
    expect(done).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:expanded')).toEqual([[false]])
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ expanded: false })
    expect(root.get('[data-runtime-stub]').element).toBe(runtime)
    dialog.props('beforeClose')(done)
    expect(done).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    target.remove()
  })
})
