// @vitest-environment happy-dom

import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '@moluoxixi/config-form-compiler'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
  RuntimeHostApp,
} from '..'

const adapterControl = vi.hoisted(() => {
  let release: ((adapter: { runtimeResolver: object }) => void) | undefined
  return {
    load: vi.fn(() => new Promise<{ runtimeResolver: object }>((resolve) => {
      release = resolve
    })),
    release: () => release?.({ runtimeResolver: {} }),
  }
})

const runtimeController = vi.hoisted(() => {
  let errors: Record<string, string[]> = {}
  const touched = new Set<string>()
  return {
    getErrors: vi.fn(() => structuredClone(errors)),
    getMeta: vi.fn(() => ({
      fields: Object.fromEntries([...touched].map(field => [field, { touched: true }])),
    })),
    setErrors: vi.fn((value: Record<string, string[]>) => {
      errors = structuredClone(value)
    }),
    setTouched: vi.fn((fieldsOrTouched: readonly string[] | boolean, value = true) => {
      if (typeof fieldsOrTouched === 'boolean') {
        if (!fieldsOrTouched)
          touched.clear()
        return
      }
      fieldsOrTouched.forEach(field => value ? touched.add(field) : touched.delete(field))
    }),
    submit: vi.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
  }
})

vi.mock('../../adapters', () => ({
  loadWorkbenchRuntimeAdapter: adapterControl.load,
}))

vi.mock('@moluoxixi/config-form-vue-backend', () => ({
  compileCanonicalPageRuntime: vi.fn(() => ({
    success: true,
    artifact: {
      compilationKey: {},
      pageId: 'home',
      plan: { renderer: { fields: [] } },
    },
    diagnostics: [],
  })),
}))

vi.mock('@moluoxixi/config-form', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    ConfigFormRenderer: defineComponent({
      name: 'ConfigFormRendererStub',
      props: {
        modelValue: {
          type: Object,
          required: true,
        },
      },
      setup(props, { expose }) {
        expose(runtimeController)
        return () => h('pre', { 'data-runtime-model': '' }, JSON.stringify(props.modelValue))
      },
    }),
  }
})

function compilation(pageId = 'home'): PageCompilation {
  return {
    snapshotIdentity: {
      source: 'committed',
      projectId: 'project',
      pageId,
      contentHash: 'fnv1a:project',
      editVersion: 1,
    },
    registryUsage: [],
    key: {
      irVersion: CANONICAL_PROJECT_IR_VERSION,
      projectId: 'project',
      pageId,
      registryAdapter: 'element-plus',
      registryAdapterVersion: '1',
      registryUsageHash: 'fnv1a:registry',
      compilerVersion: CONFIG_FORM_COMPILER_VERSION,
      environmentHash: 'fnv1a:environment',
      semanticHash: 'fnv1a:page',
    },
    page: {
      id: pageId,
      name: 'Home',
      route: '/',
      props: {},
      form: {},
      rootIds: [],
      nodesById: {},
      flows: [],
    },
  }
}

function dispatchParentMessage(payload: Record<string, unknown>): void {
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId: 'preview-host',
      projectId: 'project',
      pageId: 'home',
      revision: 'project:home:1',
      ...payload,
    },
    origin: window.location.origin,
    source: window.parent,
  }))
}

describe('runtime host app', () => {
  it('restores the newest state when it arrives while structural sync is compiling', async () => {
    const wrapper = mount(RuntimeHostApp)
    dispatchParentMessage({
      type: 'sync',
      sequence: 1,
      adapter: 'element-plus',
      compilation: compilation(),
      mode: 'preview',
      locale: 'en-US',
      runtimeState: {
        values: { name: 'Initial' },
        touched: [],
        validation: {},
      },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
      runtimeSessionKey: 'project:element-plus:home',
    })
    dispatchParentMessage({
      type: 'state',
      sequence: 2,
      runtimeState: {
        values: { name: 'Latest' },
        touched: ['name'],
        validation: { name: ['Required'] },
      },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
    })

    adapterControl.release()

    await vi.waitFor(() => {
      expect(wrapper.get('[data-runtime-model]').text()).toBe('{"name":"Latest"}')
      expect(runtimeController.setTouched).toHaveBeenCalledWith(['name'], true)
      expect(runtimeController.setErrors).toHaveBeenCalledWith({ name: ['Required'] })
    })

    dispatchParentMessage({
      type: 'state',
      sequence: 3,
      runtimeState: {
        values: { name: 'Latest' },
        touched: ['name'],
        validation: { name: ['Required'] },
      },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
    })
    await nextTick()
    await nextTick()

    expect(runtimeController.setErrors).toHaveBeenCalledTimes(1)
    expect(runtimeController.setTouched).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('reports invalid submissions without a success event and reports successful values atomically', async () => {
    runtimeController.submit.mockReset()
    runtimeController.submit
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const wrapper = mount(RuntimeHostApp)

    dispatchParentMessage({
      type: 'sync',
      sequence: 1,
      adapter: 'element-plus',
      compilation: compilation(),
      mode: 'preview',
      locale: 'en-US',
      runtimeState: { values: { name: 'Ada' }, touched: [], validation: {} },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
      runtimeSessionKey: 'project:element-plus:home',
    })
    adapterControl.release()
    await vi.waitFor(() => expect(postMessage.mock.calls.some(([payload]) => (payload as { type?: string }).type === 'ready')).toBe(true))

    dispatchParentMessage({ type: 'submit', sequence: 2 })
    await vi.waitFor(() => expect(postMessage.mock.calls.some(([payload]) => {
      const value = payload as { type?: string, payload?: { status?: string } }
      return value.type === 'submitResult' && value.payload?.status === 'invalid'
    })).toBe(true))
    expect(postMessage.mock.calls.some(([payload]) => (payload as { type?: string }).type === 'submit')).toBe(false)

    dispatchParentMessage({ type: 'submit', sequence: 3 })
    await vi.waitFor(() => expect(postMessage.mock.calls.some(([payload]) => {
      const value = payload as { type?: string, payload?: { status?: string } }
      return value.type === 'submitResult' && value.payload?.status === 'success'
    })).toBe(true))
    expect(postMessage.mock.calls.some(([payload]) => (payload as { type?: string }).type === 'submit')).toBe(true)

    wrapper.unmount()
    postMessage.mockRestore()
  })

  it('drops a submission result when a newer structural sync changes its identity', async () => {
    let resolveSubmit: ((valid: boolean) => void) | undefined
    runtimeController.submit.mockReset()
    runtimeController.submit.mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveSubmit = resolve
    }))
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const wrapper = mount(RuntimeHostApp)

    dispatchParentMessage({
      type: 'sync',
      sequence: 1,
      adapter: 'element-plus',
      compilation: compilation(),
      mode: 'preview',
      locale: 'en-US',
      runtimeState: { values: { name: 'Ada' }, touched: [], validation: {} },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
      runtimeSessionKey: 'project:element-plus:home',
    })
    adapterControl.release()
    await vi.waitFor(() => expect(postMessage.mock.calls.some(([payload]) => (payload as { type?: string }).type === 'ready')).toBe(true))

    dispatchParentMessage({ type: 'submit', sequence: 2 })
    await vi.waitFor(() => expect(runtimeController.submit).toHaveBeenCalledTimes(1))
    dispatchParentMessage({
      type: 'sync',
      sequence: 3,
      adapter: 'element-plus',
      compilation: compilation('settings'),
      mode: 'preview',
      locale: 'en-US',
      runtimeState: { values: { name: 'Grace' }, touched: [], validation: {} },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
      pageId: 'settings',
      revision: 'project:settings:2',
      runtimeSessionKey: 'project:element-plus:settings',
    })
    resolveSubmit?.(true)
    await nextTick()
    await nextTick()

    expect(postMessage.mock.calls.some(([payload]) => {
      const value = payload as { type?: string }
      return value.type === 'submitResult' || value.type === 'submit'
    })).toBe(false)

    wrapper.unmount()
    postMessage.mockRestore()
  })
})
