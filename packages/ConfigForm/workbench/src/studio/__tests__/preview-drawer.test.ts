// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { PreviewDrawer } from '../../app'
import { WorkbenchCommandHint } from '../../app/components'

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

  it('presents preview as a centered modal dialog and collapses the empty result panel', async () => {
    const { root, target, wrapper } = mountPreviewDrawer(props())

    await flushPromises()

    // Preview is a dialog, not a side drawer: it is modal from the start.
    expect(root.find('.preview-dialog-shell').exists()).toBe(true)
    expect(root.find('.el-drawer').exists()).toBe(false)
    expect(root.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    // Without a submission the result panel only claims its own height.
    expect(root.get('[role="complementary"]').classes()).toContain('is-result-empty')

    await wrapper.setProps({
      lastSubmission: {
        status: 'success',
        values: { name: 'a' },
        touched: ['name'],
        validation: {},
        revisionKey: 'project:home:1',
        submittedAt: 1,
      },
    })
    await nextTick()
    expect(root.get('[role="complementary"]').classes()).not.toContain('is-result-empty')

    wrapper.unmount()
    target.remove()
  })

  it('keeps the empty state usable before the first submission', async () => {
    const { root, target, wrapper } = mountPreviewDrawer(props())

    await flushPromises()

    expect(root.get('[data-preview-results]').text()).toContain('No submission')
    expect(root.find('[data-runtime-stub]').exists()).toBe(true)
    expect(wrapper.findAllComponents(WorkbenchCommandHint)).toHaveLength(6)
    const submit = root.get('button[aria-label="Submit preview form"]')
    expect(submit.attributes('aria-disabled')).toBe('true')
    expect(wrapper.findAllComponents(WorkbenchCommandHint)
      .find(hint => hint.props('label') === 'Submit preview form')
      ?.props('disabledReason')).toBe('Preview is not ready to submit')
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

  it('switches result tabs with the keyboard and gives run history the full result area', async () => {
    const { root, target, wrapper } = mountPreviewDrawer(props())
    await flushPromises()
    const submissionTab = root.get('#preview-submission-tab')
    expect(root.get('#preview-trace-panel').attributes('hidden')).toBeDefined()
    await submissionTab.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    const traceTab = root.get('#preview-trace-tab')
    expect(traceTab.attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(traceTab.element)
    expect(root.get('#preview-trace-panel').attributes('hidden')).toBeUndefined()
    expect(root.get('#preview-submission-panel').attributes('hidden')).toBeDefined()
    expect(root.get('[role="complementary"]').classes()).not.toContain('is-result-empty')
    await traceTab.trigger('keydown', { key: 'Home' })
    expect(submissionTab.attributes('aria-selected')).toBe('true')
    expect(root.get('[role="complementary"]').classes()).toContain('is-result-empty')
    await submissionTab.trigger('keydown', { key: 'ArrowLeft' })
    expect(traceTab.attributes('aria-selected')).toBe('true')
    await traceTab.trigger('keydown', { key: 'ArrowRight' })
    expect(submissionTab.attributes('aria-selected')).toBe('true')
    await submissionTab.trigger('keydown', { key: 'End' })
    expect(traceTab.attributes('aria-selected')).toBe('true')
    wrapper.unmount()
    target.remove()
  })

  it('renders bounded snapshots, duration, and diagnostic paths as escaped text', async () => {
    const events = Array.from({ length: 201 }, (_, index) => ({
      type: 'exit', flowId: 'load-cities', runId: `run-${index}`, revision: 1,
      nodeId: 'request', timestamp: index, durationMs: 12.5, status: 'success',
      output: index === 200 ? '<img src=x onerror=alert(1)>' + 'x'.repeat(6000) : null,
    }))
    const { root, target, wrapper } = mountPreviewDrawer({
      ...props(),
      flowTrace: events,
      flows: [{ id: 'load-cities', name: 'Load cities', nodes: [] }],
      flowDiagnostics: [{ code: 'FLOW_FIELD_MISSING', message: 'Missing field', path: 'nodes[1].config.input.city' }],
    })
    await flushPromises()
    await root.get('#preview-trace-tab').trigger('click')
    const rows = root.findAll('.preview-trace-list > li')
    expect(rows).toHaveLength(200)
    expect(rows[0]!.text()).toContain('run-200')
    expect(rows[199]!.text()).toContain('run-1')
    expect(rows[0]!.get('summary').text()).toContain('Load cities / request')
    expect(rows[0]!.get('summary').text()).toContain('12.5 ms')
    expect(rows[0]!.get('pre').text().length).toBeLessThanOrEqual(4100)
    expect(rows[0]!.get('pre').text()).toContain('<img src=x onerror=alert(1)>')
    expect(rows[0]!.find('img').exists()).toBe(false)
    expect(root.get('.preview-trace-diagnostics').text()).toContain('FLOW_FIELD_MISSING')
    expect(root.get('.preview-trace-diagnostics code').text()).toBe('nodes[1].config.input.city')
    expect(events).toHaveLength(201)
    wrapper.unmount()
    target.remove()
  })

  it('forwards frame trace events without executing trusted actions', async () => {
    const get = vi.fn()
    const { target, wrapper } = mountPreviewDrawer({ ...props(), flowActions: { get } })
    await flushPromises()
    const event = {
      hostId: 'host', projectId: 'project', pageId: 'home', revision: 'project:home:1',
      trace: { type: 'start', flowId: 'flow', runId: 'run', revision: 1, timestamp: 1 },
    }
    wrapper.findComponent(RuntimeStub).vm.$emit('flowTrace', event)
    expect(wrapper.emitted('flowTrace')).toEqual([[event]])
    for (const name of ['flowError', 'flowProjection', 'flowResult']) {
      wrapper.findComponent(RuntimeStub).vm.$emit(name, event)
      expect(wrapper.emitted(name)).toEqual([[event]])
    }
    expect(get).not.toHaveBeenCalled()
    wrapper.unmount()
    target.remove()
  })

  it('retains expanded trace rows when new events arrive and bounds error messages', async () => {
    const trace = { type: 'error', flowId: 'flow', runId: 'old', revision: 1, nodeId: 'step-a', timestamp: 1, error: 'x'.repeat(9000) }
    const { root, target, wrapper } = mountPreviewDrawer({
      ...props(), flowTrace: [trace],
      flowDiagnostics: [{ code: 'WARNING', message: 'y'.repeat(9000), nodeId: 'step-a', edgeId: 'branch-a', severity: 'warning' }],
    })
    await flushPromises()
    await root.get('#preview-trace-tab').trigger('click')
    const details = root.get('.preview-trace-list details').element as HTMLDetailsElement
    details.open = true
    const summary = details.querySelector('summary')!
    summary.focus()
    await wrapper.setProps({ flowTrace: [trace, { ...trace, runId: 'new', timestamp: 2 }] })
    expect(root.findAll('.preview-trace-list details')[1]!.element).toBe(details)
    expect(details.open).toBe(true)
    expect(document.activeElement).toBe(summary)
    const payload = root.findAll('.preview-trace-payload')[1]!
    expect(payload.findAll('dd')[1]!.text().length).toBeLessThanOrEqual(4100)
    const diagnostic = root.get('.preview-trace-diagnostics li')
    expect(diagnostic.attributes('data-severity')).toBe('warning')
    expect(diagnostic.get('span').text().length).toBeLessThanOrEqual(4100)
    expect(diagnostic.text()).toContain('Step: step-a')
    expect(diagnostic.text()).toContain('Branch: branch-a')
    wrapper.unmount()
    target.remove()
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
