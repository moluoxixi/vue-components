// @vitest-environment happy-dom
import type { PrototypeProjectContextV1 } from '@moluoxixi/config-form-prototype-runtime/session'
import { compileCanonicalProject, compileCanonicalSurface } from '@moluoxixi/config-form-compiler'
import {
  createPrototypeInstanceRuntimeSnapshot,
  createPrototypeProjectContext,
  initializePrototypeProjectSession,
  reducePrototypeSession,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION, RuntimeHostApp } from '..'
import { createCompilerFixture, createExperienceCompilerFixture } from './compiler-fixture'

const adapter = vi.hoisted(() => ({ load: vi.fn().mockResolvedValue({ runtimeResolver: {} }) }))
vi.mock('../../adapters', () => ({ loadWorkbenchRuntimeAdapter: adapter.load }))
vi.mock('@moluoxixi/config-form-vue-backend', () => ({
  compileCanonicalSurfaceRuntime: vi.fn((input: { compilation: { surface?: { id?: string } }, surfaceId?: string }) => {
    const surfaceId = input.surfaceId ?? input.compilation.surface?.id ?? 'home'
    return {
      success: true,
      artifact: {
        compilationKey: {},
        surfaceId,
        renderer: {
          fields: [{ id: `${surfaceId}-action` }],
          plan: {
            valueSchema: { valueScopes: [], scopedFields: [] },
            runtime: { variables: [], dataSources: [] },
            optionBindings: [],
          },
        },
      },
      diagnostics: [],
    }
  }),
}))
vi.mock('@moluoxixi/config-form', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    ConfigFormRenderer: defineComponent({
      name: 'ConfigFormRendererStub',
      props: {
        fields: { type: Array, default: () => [] },
        model: { type: Object, required: true },
      },
      setup(props, { expose }) {
        expose({
          getInstanceErrors: () => [],
          getInstanceKey: (address: { nodeId: string }) => address.nodeId,
          getInstanceMeta: () => ({ touched: false }),
          getValues: () => props.model.read(),
          listFieldInstances: () => [],
          setErrors: vi.fn(),
          setInstanceTouched: vi.fn(),
          setValues: vi.fn(),
          validate: () => true,
          validateInstance: () => true,
        })
        return () => h('div', [
          h('pre', { 'data-runtime-model': '' }, JSON.stringify(props.model.read())),
          ...props.fields.map(field => h('button', {
            'data-config-node-id': (field as { id: string }).id,
            'type': 'button',
          }, (field as { id: string }).id)),
        ])
      },
    }),
  }
})

function compilation() {
  const result = compileCanonicalSurface({ ...createCompilerFixture(3), surfaceId: 'home' })
  if (!result.success)
    throw new Error('fixture compilation failed')
  return result.compilation
}

function experienceCompilation(homeTrigger: 'activate' | 'submit' = 'activate') {
  const result = compileCanonicalProject(createExperienceCompilerFixture(3, homeTrigger))
  if (!result.success)
    throw new Error('Experience fixture compilation failed')
  return result.compilation
}

function dispatch(payload: Record<string, unknown>, sequence: number) {
  window.dispatchEvent(new MessageEvent('message', {
    data: {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId: 'host',
      projectId: 'project',
      revision: 'revision',
      sequence,
      ...payload,
    },
    origin: window.location.origin,
    source: window.parent,
  }))
}

function runtime(context: PrototypeProjectContextV1, surfaceId: string, prefix: string) {
  const surface = context.surfacesById[surfaceId]!
  const result = createPrototypeInstanceRuntimeSnapshot(
    surface,
    structuredClone(surface.initialValues),
    ({ scopeId, attempt }) => `${prefix}-${scopeId}-${attempt}`,
  )
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Runtime fixture failed')
  return result.data
}

function nestedExperienceSession(project: ReturnType<typeof experienceCompilation>) {
  const context = createPrototypeProjectContext(project)
  if (!context.success)
    throw new Error(context.diagnostics[0]?.message ?? 'Context fixture failed')
  const initialized = initializePrototypeProjectSession({
    compilation: project,
    homeInstanceId: 'page-1',
    createRowId: ({ scopeId, attempt }) => `home-${scopeId}-${attempt}`,
  })
  if (!initialized.success)
    throw new Error(initialized.diagnostics[0]?.message ?? 'Session fixture failed')
  const openedDialog = reducePrototypeSession(initialized.data, {
    type: 'interaction.activate',
    sourceInstanceId: 'page-1',
    sourceAddress: { nodeId: 'home-action', scope: [] },
    interactionId: 'open-dialog',
    nextInstance: {
      instanceId: 'dialog-1',
      runtime: runtime(context.data, 'dialog', 'dialog'),
    },
  }, context.data)
  const openedDrawer = reducePrototypeSession(openedDialog.session, {
    type: 'interaction.activate',
    sourceInstanceId: 'dialog-1',
    sourceAddress: { nodeId: 'dialog-action', scope: [] },
    interactionId: 'open-drawer',
    nextInstance: {
      instanceId: 'drawer-1',
      runtime: runtime(context.data, 'drawer', 'drawer'),
    },
  }, context.data)
  if (openedDrawer.diagnostics.length > 0)
    throw new Error(openedDrawer.diagnostics[0]?.message ?? 'Nested session fixture failed')
  return { context: context.data, session: openedDrawer.session }
}

describe('runtime host app v7', () => {
  it('applies only the newest design.state after design.sync', async () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const wrapper = mount(RuntimeHostApp)
    const state = { fields: [], touched: [], validation: {}, values: { name: 'Initial' } }
    dispatch({ type: 'design.sync', surfaceId: 'home', payload: { adapter: 'element-plus', breakpoint: 'desktop', compilation: compilation(), locale: 'en-US', runtimeSessionKey: 'design', runtimeState: state, variant: 'canvas' } }, 1)
    await vi.waitFor(() => expect(wrapper.get('[data-runtime-model]').text()).toBe('{"name":"Initial"}'))
    dispatch({ type: 'design.state', surfaceId: 'home', payload: { ...state, values: { name: 'Latest' } } }, 2)
    await vi.waitFor(() => expect(wrapper.get('[data-runtime-model]').text()).toBe('{"name":"Latest"}'))
    dispatch({ type: 'design.state', surfaceId: 'home', payload: { ...state, values: { name: 'Replay' } } }, 2)
    dispatch({ type: 'design.state', surfaceId: 'home', payload: { ...state, values: { name: 'Backwards' } } }, 1)
    dispatch({ type: 'design.state', surfaceId: 'home', revision: 'stale-revision', payload: { ...state, values: { name: 'Stale' } } }, 3)
    dispatch({ type: 'experience.command', sessionId: 'experience-1', command: { type: 'history.back' } }, 3)
    expect(wrapper.get('[data-runtime-model]').text()).toBe('{"name":"Latest"}')
    dispatch({ type: 'design.state', surfaceId: 'home', payload: { ...state, values: { name: 'Final' } } }, 3)
    await vi.waitFor(() => expect(wrapper.get('[data-runtime-model]').text()).toBe('{"name":"Final"}'))
    expect(post.mock.calls.some(([v]) => (v as { type?: string }).type === 'ready')).toBe(true)
    expect(post.mock.calls.some(([v]) => ['sync', 'state', 'fieldChange', 'submitResult'].includes((v as { type?: string }).type ?? ''))).toBe(false)
    wrapper.unmount()
    post.mockRestore()
  })

  it('hydrates nested overlays and keeps command reduction, disposal, and focus inside the child', async () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const project = experienceCompilation()
    const fixture = nestedExperienceSession(project)
    const wrapper = mount(RuntimeHostApp, { attachTo: document.body })

    dispatch({
      type: 'experience.sync',
      sessionId: 'experience-1',
      payload: {
        adapter: 'element-plus',
        compilation: project,
        locale: 'en-US',
        session: fixture.session,
      },
    }, 1)

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.mx-prototype-host__overlay')).toHaveLength(2)
    })
    expect(document.querySelector('[data-instance-id="drawer-1"]')?.getAttribute('data-top')).toBe('true')

    dispatch({
      type: 'experience.command',
      sessionId: 'experience-1',
      command: { type: 'overlay.dismiss', instanceId: 'drawer-1', reason: 'button' },
    }, 2)
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.mx-prototype-host__overlay')).toHaveLength(1)
    })
    await vi.waitFor(() => {
      expect(post.mock.calls.some(([message]) => {
        const candidate = message as { type?: string, instanceId?: string, payload?: { focusedAddress?: { nodeId?: string } } }
        return candidate.type === 'experience.instanceState'
          && candidate.instanceId === 'dialog-1'
          && candidate.payload?.focusedAddress?.nodeId === 'dialog-action'
      })).toBe(true)
    })

    dispatch({
      type: 'experience.command',
      sessionId: 'other-experience',
      command: {
        type: 'interaction.activate',
        sourceInstanceId: 'dialog-1',
        sourceAddress: { nodeId: 'dialog-action', scope: [] },
        interactionId: 'open-drawer',
        nextInstance: {
          instanceId: 'drawer-2',
          runtime: runtime(fixture.context, 'drawer', 'drawer-2'),
        },
      },
    }, 3)
    expect(document.querySelector('[data-instance-id="drawer-2"]')).toBeNull()

    dispatch({
      type: 'experience.command',
      sessionId: 'experience-1',
      command: {
        type: 'interaction.activate',
        sourceInstanceId: 'dialog-1',
        sourceAddress: { nodeId: 'dialog-action', scope: [] },
        interactionId: 'open-drawer',
        nextInstance: {
          instanceId: 'drawer-2',
          runtime: runtime(fixture.context, 'drawer', 'drawer-2'),
        },
      },
    }, 3)
    await vi.waitFor(() => {
      expect(document.querySelector('[data-instance-id="drawer-2"]')).not.toBeNull()
      expect(document.querySelectorAll('.mx-prototype-host__overlay')).toHaveLength(2)
    })

    const sessionMessages = post.mock.calls
      .map(([message]) => message as { type?: string, transition?: { session?: { overlayStack?: string[] } } })
      .filter(message => message.type === 'experience.session')
    expect(sessionMessages.at(-1)?.transition?.session?.overlayStack).toEqual(['dialog-1', 'drawer-2'])
    expect(sessionMessages.at(-1)?.transition).not.toHaveProperty('effects')
    wrapper.unmount()
    post.mockRestore()
  })

  it('dispatches semantic activation from rendered Surface controls', async () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const project = experienceCompilation()
    const initialized = initializePrototypeProjectSession({
      compilation: project,
      homeInstanceId: 'page-1',
      createRowId: ({ scopeId, attempt }) => `home-${scopeId}-${attempt}`,
    })
    if (!initialized.success)
      throw new Error(initialized.diagnostics[0]?.message ?? 'Experience session failed')
    const wrapper = mount(RuntimeHostApp, { attachTo: document.body })

    dispatch({
      type: 'experience.sync',
      sessionId: 'experience-1',
      payload: {
        adapter: 'element-plus',
        compilation: project,
        locale: 'en-US',
        session: initialized.data,
      },
    }, 1)

    await vi.waitFor(() => {
      expect(document.querySelector('[data-config-node-id="home-action"]')).not.toBeNull()
    })
    document.querySelector<HTMLElement>('[data-config-node-id="home-action"]')!.click()
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.mx-prototype-host__overlay')).toHaveLength(1)
      expect(document.querySelector('[data-config-node-id="dialog-action"]')).not.toBeNull()
    })

    document.querySelector<HTMLElement>('[data-config-node-id="dialog-action"]')!.click()
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.mx-prototype-host__overlay')).toHaveLength(2)
    })

    const sessionMessages = post.mock.calls
      .map(([message]) => message as { type?: string, transition?: { session?: { overlayStack?: string[] } } })
      .filter(message => message.type === 'experience.session')
    expect(sessionMessages.at(-1)?.transition?.session?.overlayStack).toHaveLength(2)
    wrapper.unmount()
    post.mockRestore()
  })

  it('dispatches semantic submit without forwarding the DOM event', async () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    const project = experienceCompilation('submit')
    const initialized = initializePrototypeProjectSession({
      compilation: project,
      homeInstanceId: 'page-1',
      createRowId: ({ scopeId, attempt }) => `home-${scopeId}-${attempt}`,
    })
    if (!initialized.success)
      throw new Error(initialized.diagnostics[0]?.message ?? 'Experience session failed')
    const wrapper = mount(RuntimeHostApp, { attachTo: document.body })

    dispatch({
      type: 'experience.sync',
      sessionId: 'experience-1',
      payload: {
        adapter: 'element-plus',
        compilation: project,
        locale: 'en-US',
        session: initialized.data,
      },
    }, 1)

    await vi.waitFor(() => {
      expect(document.querySelector('.runtime-host-experience-instance')).not.toBeNull()
    })
    document.querySelector<HTMLElement>('.runtime-host-experience-instance')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(document.querySelectorAll('.mx-prototype-host__overlay')).toHaveLength(1)
    })
    const sessionMessages = post.mock.calls
      .map(([message]) => message as { type?: string, transition?: { session?: { overlayStack?: string[] } } })
      .filter(message => message.type === 'experience.session')
    expect(sessionMessages.at(-1)?.transition?.session?.overlayStack).toHaveLength(1)
    expect(post.mock.calls.some(([message]) => (
      (message as { command?: unknown }).command instanceof Event
    ))).toBe(false)
    wrapper.unmount()
    post.mockRestore()
  })
})
