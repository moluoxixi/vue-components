import type { ConfigFormValueScopeRowIdFactory } from '@moluoxixi/config-form-core'
import type { PropType } from 'vue'
import type {
  ModelJsonObject,
  PrototypeInstanceProjectionV1,
  PrototypeInstanceRuntimeSnapshotV1,
  PrototypeProjectContextV1,
  PrototypeSessionEffect,
  PrototypeSessionV1,
  PrototypeTransition,
  SurfaceInstanceV1,
} from '../src/session'
import type {
  PrototypeSurfaceHostExpose,
  PrototypeVueInstanceController,
  PrototypeVueSurfaceArtifact,
  PrototypeVueSurfaceRendererBindings,
} from '../src/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, onUpdated } from 'vue'
import { PrototypeSurfaceHost } from '../src/vue'
import {
  createPrototypeVueControllerRegistry,
  createPrototypeVueEffectExecutor,
  createPrototypeVueHostController,
} from '../src/vue/services'

const emptyRuntime: PrototypeInstanceRuntimeSnapshotV1 = {
  nodeAddresses: [],
  fieldInstances: [],
}
const hydratedRuntime: PrototypeInstanceRuntimeSnapshotV1 = {
  nodeAddresses: [{ nodeId: 'open', scope: [] }],
  fieldInstances: [],
}
const emptyProjection: PrototypeInstanceProjectionV1 = []

function topology(...nodeIds: string[]) {
  return {
    nodeOrder: nodeIds,
    ownerScopeIdByNodeId: Object.fromEntries(nodeIds.map(nodeId => [nodeId, null])),
    valueScopes: [],
    scopedFields: [],
  }
}

function context(validation = false): PrototypeProjectContextV1 {
  return {
    version: 1,
    projectId: 'project',
    homeSurfaceId: 'home',
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        route: '/',
        initialValues: {},
        parameters: [],
        outputs: [],
        topology: topology('open'),
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-dialog',
          nodeId: 'open',
          trigger: 'activate',
          ...(validation ? { validate: { scope: 'surface' as const } } : {}),
          action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
        }],
      },
      dialog: {
        id: 'dialog',
        kind: 'dialog',
        presentation: {
          kind: 'dialog',
          title: 'Details',
          width: { desktop: { value: 480, unit: 'px' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        initialValues: {},
        parameters: [],
        outputs: [],
        topology: topology('open'),
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-dialog',
          nodeId: 'open',
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
        }],
      },
    },
  }
}

function itemActivationContext(
  trigger: 'rowActivate' | 'itemActivate',
): PrototypeProjectContextV1 {
  const base = context()
  return {
    ...base,
    surfacesById: {
      ...base.surfacesById,
      home: {
        ...base.surfacesById.home!,
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-dialog-from-item',
          nodeId: 'open',
          trigger,
          action: {
            kind: 'open',
            targetSurfaceId: 'dialog',
            parameters: [{
              name: 'selected',
              value: { version: 1, ast: { kind: 'reference', scope: 'item', path: [] } },
            }],
          },
        }],
      },
      dialog: {
        ...base.surfacesById.dialog!,
        parameters: [{ name: 'selected', required: true }],
        interactions: [],
      },
    },
  }
}

interface ControllerFixture {
  controller: PrototypeVueInstanceController
  calls: string[]
}

function controllerFixture(name: string, valid = true): ControllerFixture {
  const calls: string[] = []
  return {
    calls,
    controller: {
      replaceValues: replacement => calls.push(`${name}:values:${JSON.stringify(replacement.values)}`),
      replaceProjection: () => calls.push(`${name}:projection`),
      validateSurface: () => {
        calls.push(`${name}:validate-surface`)
        return valid
      },
      validateFields: () => {
        calls.push(`${name}:validate-fields`)
        return valid
      },
      focus: address => calls.push(`${name}:focus:${address.nodeId}`),
      dispose: () => calls.push(`${name}:dispose`),
    },
  }
}

function instance(instanceId: string, surfaceId = 'dialog'): SurfaceInstanceV1 {
  return {
    instanceId,
    surfaceId,
    parameters: {},
    values: {},
    runtime: emptyRuntime,
    projection: emptyProjection,
  }
}

function session(instances: readonly SurfaceInstanceV1[]): PrototypeSessionV1 {
  return {
    version: 1,
    projectId: 'project',
    pageHistory: instances.filter(item => item.surfaceId === 'home').map(item => item.instanceId),
    overlayStack: instances.filter(item => item.surfaceId !== 'home').map(item => item.instanceId),
    instancesById: Object.fromEntries(instances.map(item => [item.instanceId, item])),
  }
}

function hydratedSession(
  pageValues: ModelJsonObject = {},
  overlayIds: readonly string[] = [],
): PrototypeSessionV1 {
  const page = { ...instance('page-1', 'home'), values: pageValues, runtime: hydratedRuntime }
  const overlays = overlayIds.map((instanceId, index): SurfaceInstanceV1 => ({
    ...instance(instanceId),
    runtime: hydratedRuntime,
    parentInstanceId: index === 0 ? page.instanceId : overlayIds[index - 1]!,
    openerAddress: { nodeId: 'open', scope: [] },
    openerInteractionId: 'open-dialog',
  }))
  return session([page, ...overlays])
}

describe('prototype Vue controller registry', () => {
  it('notifies subscribers for instance state without publishing controller registration', () => {
    const registry = createPrototypeVueControllerRegistry()
    const page = instance('page-1', 'home')
    let notifications = 0
    registry.subscribe(() => notifications += 1)

    registry.mount(page)
    expect(notifications).toBe(1)

    const fixture = controllerFixture('page')
    const unregister = registry.register(page.instanceId, fixture.controller)
    expect(registry.get(page.instanceId)?.controller).toBe(fixture.controller)
    expect(notifications).toBe(1)

    unregister()
    expect(registry.get(page.instanceId)?.controller).toBeUndefined()
    expect(notifications).toBe(1)

    registry.replaceValues(page.instanceId, { values: { name: 'Ada' }, changedAddresses: [] })
    expect(notifications).toBe(2)
  })
})

describe('prototype Vue effect execution', () => {
  it('isolates repeated Surface instances and executes one transition exactly once in order', () => {
    const registry = createPrototypeVueControllerRegistry()
    const first = instance('dialog-1')
    const second = instance('dialog-2')
    registry.mount(first)
    registry.mount(second)
    const firstController = controllerFixture('first')
    const secondController = controllerFixture('second')
    registry.register(first.instanceId, firstController.controller)
    registry.register(second.instanceId, secondController.controller)
    firstController.calls.length = 0
    secondController.calls.length = 0

    const effects: PrototypeSessionEffect[] = [
      {
        type: 'instance.values.replace',
        instanceId: first.instanceId,
        values: { name: 'Changed' },
        changedAddresses: [],
      },
      {
        type: 'instance.projection.replace',
        instanceId: first.instanceId,
        projection: emptyProjection,
      },
    ]
    const transition: PrototypeTransition = {
      session: session([first, second]),
      diagnostics: [],
      effects,
    }
    const order: string[] = []
    const executor = createPrototypeVueEffectExecutor({
      registry,
      onEffect: effect => order.push(effect.type),
    })

    executor.execute(transition)
    executor.execute(transition)

    expect(order).toEqual(['instance.values.replace', 'instance.projection.replace'])
    expect(firstController.calls).toEqual([
      'first:values:{"name":"Changed"}',
      'first:projection',
    ])
    expect(secondController.calls).toEqual([])
    expect(registry.get(second.instanceId)?.values).toEqual({})
  })

  it('disposes closed controllers before restoring focus to the live opener', () => {
    const registry = createPrototypeVueControllerRegistry()
    const page = instance('page-1', 'home')
    const dialog = instance('dialog-1')
    registry.mount(page)
    registry.mount(dialog)
    const pageController = controllerFixture('page')
    const dialogController = controllerFixture('dialog')
    registry.register(page.instanceId, pageController.controller)
    registry.register(dialog.instanceId, dialogController.controller)
    pageController.calls.length = 0
    dialogController.calls.length = 0
    const scheduled: Array<() => void> = []
    const order: string[] = []
    const executor = createPrototypeVueEffectExecutor({
      registry,
      scheduleFocus: callback => scheduled.push(callback),
      onEffect: effect => order.push(effect.type),
    })
    const transition: PrototypeTransition = {
      session: session([page]),
      diagnostics: [],
      effects: [
        { type: 'instance.dispose', instanceId: dialog.instanceId },
        {
          type: 'focus.restore',
          instanceId: page.instanceId,
          address: { nodeId: 'open', scope: [] },
        },
      ],
    }

    executor.execute(transition)
    scheduled.forEach(callback => callback())

    expect(order).toEqual(['instance.dispose', 'focus.restore'])
    expect(dialogController.calls).toEqual(['dialog:dispose'])
    expect(pageController.calls).toEqual(['page:focus:open'])
    expect(registry.has(dialog.instanceId)).toBe(false)
  })

  it('cancels a queued focus restore when a newer transition is executed', () => {
    const registry = createPrototypeVueControllerRegistry()
    const page = instance('page-1', 'home')
    registry.mount(page)
    const pageController = controllerFixture('page')
    registry.register(page.instanceId, pageController.controller)
    pageController.calls.length = 0
    const scheduled: Array<() => void> = []
    const executor = createPrototypeVueEffectExecutor({
      registry,
      scheduleFocus: callback => scheduled.push(callback),
    })
    executor.execute({
      session: session([page]),
      diagnostics: [],
      effects: [{
        type: 'focus.restore',
        instanceId: page.instanceId,
        address: { nodeId: 'open', scope: [] },
      }],
    })
    executor.execute({
      session: session([page]),
      diagnostics: [],
      effects: [],
    })
    scheduled.forEach(callback => callback())

    expect(pageController.calls).toEqual([])
  })
})

describe('prototype Vue host controller', () => {
  it('hydrates a complete initial session and reconciles later replacements by instance identity', () => {
    const initial = hydratedSession({ title: 'Initial' }, ['dialog-1', 'dialog-2'])
    const host = createPrototypeVueHostController({ context: context(), initialSession: initial })

    expect(host.getSnapshot().diagnostics).toEqual([])
    expect(host.getSnapshot().session.overlayStack).toEqual(['dialog-1', 'dialog-2'])
    expect(host.registry.ids()).toEqual(['page-1', 'dialog-1', 'dialog-2'])
    expect(host.registry.get('page-1')?.values).toEqual({ title: 'Initial' })

    const retained = controllerFixture('page')
    const removed = controllerFixture('dialog-2')
    host.registry.register('page-1', retained.controller)
    host.registry.register('dialog-2', removed.controller)
    retained.calls.length = 0
    removed.calls.length = 0

    const replacement = hydratedSession({ title: 'Replacement' }, ['dialog-1'])
    const next = host.replaceSession(replacement)

    expect(next.diagnostics).toEqual([])
    expect(next.session.overlayStack).toEqual(['dialog-1'])
    expect(host.registry.ids()).toEqual(['page-1', 'dialog-1'])
    expect(host.registry.get('page-1')?.values).toEqual({ title: 'Replacement' })
    expect(retained.calls).toContain('page:values:{"title":"Replacement"}')
    expect(removed.calls).toEqual(['dialog-2:dispose'])

    const beforeInvalid = host.getSnapshot().session
    const rejected = host.replaceSession({ ...replacement, instancesById: {} })
    expect(rejected.session).toBe(beforeInvalid)
    expect(rejected.diagnostics).toMatchObject([{ code: 'prototype_session_invalid' }])
    expect(host.registry.ids()).toEqual(['page-1', 'dialog-1'])
  })

  it('does not dispatch an activation when its validation gate fails', async () => {
    const effects: string[] = []
    const host = createPrototypeVueHostController({
      context: context(true),
      onEffect: effect => effects.push(effect.type),
    })
    const pageId = host.getSnapshot().session.pageHistory[0]!
    const pageController = controllerFixture('page', false)
    host.registry.register(pageId, pageController.controller)
    const before = host.getSnapshot().session
    effects.length = 0

    const result = await host.activate({
      sourceInstanceId: pageId,
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-dialog',
    })

    expect(result.status).toBe('validation-failed')
    expect(host.getSnapshot().session).toBe(before)
    expect(host.getSnapshot().session.overlayStack).toEqual([])
    expect(effects).toEqual([])
    expect(pageController.calls).toContain('page:validate-surface')
  })

  it.each(['rowActivate', 'itemActivate'] as const)(
    'clones the %s item before evaluating item-derived parameters',
    async (trigger) => {
      const host = createPrototypeVueHostController({
        context: itemActivationContext(trigger),
        createInstanceId: () => `${trigger}-dialog`,
      })
      const pageId = host.getSnapshot().session.pageHistory[0]!
      const item = { id: 'row-1', profile: { name: 'Ada' } }

      const result = await host.activate({
        sourceInstanceId: pageId,
        sourceAddress: { nodeId: 'open', scope: [] },
        interactionId: 'open-dialog-from-item',
        item,
      })
      item.profile.name = 'Changed after dispatch'

      expect(result.status).toBe('dispatched')
      expect(result.snapshot.session.instancesById[`${trigger}-dialog`]?.parameters).toEqual({
        selected: { id: 'row-1', profile: { name: 'Ada' } },
      })
      expect(result.snapshot.session.instancesById[`${trigger}-dialog`]?.parameters.selected).not.toBe(item)
    },
  )

  it('returns stale when an async validation resolves after host disposal', async () => {
    let resolveValidation!: (valid: boolean) => void
    const validation = new Promise<boolean>((resolve) => {
      resolveValidation = resolve
    })
    const host = createPrototypeVueHostController({
      context: context(true),
    })
    const pageId = host.getSnapshot().session.pageHistory[0]!
    host.registry.register(pageId, {
      replaceValues: () => {},
      replaceProjection: () => {},
      validateSurface: () => validation,
      validateFields: () => true,
      focus: () => {},
      dispose: () => {},
    })
    const activation = host.activate({
      sourceInstanceId: pageId,
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-dialog',
    })
    host.dispose()
    resolveValidation(true)

    await expect(activation).resolves.toMatchObject({ status: 'stale' })
  })

  it('allows only the top overlay to dismiss and cleans the disposed controller', async () => {
    const ids = ['dialog-1', 'dialog-2']
    const host = createPrototypeVueHostController({
      context: context(),
      createInstanceId: () => ids.shift()!,
    })
    const pageId = host.getSnapshot().session.pageHistory[0]!
    const pageController = controllerFixture('page')
    host.registry.register(pageId, pageController.controller)
    await host.activate({
      sourceInstanceId: pageId,
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-dialog',
    })
    const firstController = controllerFixture('first')
    host.registry.register('dialog-1', firstController.controller)
    await host.activate({
      sourceInstanceId: 'dialog-1',
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-dialog',
    })
    const secondController = controllerFixture('second')
    host.registry.register('dialog-2', secondController.controller)
    firstController.calls.length = 0
    secondController.calls.length = 0

    const blocked = host.dismiss('dialog-1', 'button')
    expect(blocked.session.overlayStack).toEqual(['dialog-1', 'dialog-2'])
    expect(blocked.diagnostics).toMatchObject([{ code: 'prototype_action_invalid' }])
    expect(firstController.calls).toEqual([])
    expect(secondController.calls).toEqual([])

    const closed = host.dismiss('dialog-2', 'button')
    expect(closed.diagnostics).toEqual([])
    expect(closed.session.overlayStack).toEqual(['dialog-1'])
    expect(host.registry.has('dialog-2')).toBe(false)
    expect(secondController.calls).toEqual(['second:dispose'])
    expect(firstController.calls).toEqual(['first:focus:open'])
  })

  it('replays the session row identities for each renderer mount', () => {
    const scopedContext: PrototypeProjectContextV1 = {
      version: 1,
      projectId: 'project',
      homeSurfaceId: 'home',
      surfacesById: {
        home: {
          id: 'home',
          kind: 'page',
          route: '/',
          initialValues: { rows: [{ id: 'a' }, { id: 'b' }] },
          parameters: [],
          outputs: [],
          interactions: [],
          topology: {
            nodeOrder: ['rows', 'rowField'],
            ownerScopeIdByNodeId: { rows: null, rowField: 'rows' },
            valueScopes: [{ nodeId: 'rows', field: 'rows', kind: 'array', itemKey: 'id' }],
            scopedFields: [{ nodeId: 'rowField', field: 'id', scopeId: 'rows' }],
          },
        },
      },
    }
    const host = createPrototypeVueHostController({ context: scopedContext })
    const instanceId = host.getSnapshot().session.pageHistory[0]!
    const expected = host.getSnapshot().session.instancesById[instanceId]!.runtime.fieldInstances.map(field => field.address.scope[0]!.rowId)
    const firstFactory = host.createRowIdFactory(instanceId)
    const secondFactory = host.createRowIdFactory(instanceId)
    const input: Parameters<ConfigFormValueScopeRowIdFactory>[0] = {
      scopeId: 'rows',
      parentScope: [],
      attempt: 0,
    }

    expect([firstFactory(input), firstFactory(input)]).toEqual(expected)
    expect([secondFactory(input), secondFactory(input)]).toEqual(expected)
  })
})

describe('prototypeSurfaceHost', () => {
  it('renders every live instance from a supplied initial session', async () => {
    const Renderer = defineComponent({
      name: 'HydratedPrototypeRenderer',
      props: {
        prototype: {
          type: Object as PropType<PrototypeVueSurfaceRendererBindings>,
          required: true,
        },
      },
      setup: rendererProps => () => h('div', {
        'data-rendered-instance': rendererProps.prototype.instance.instanceId,
      }),
    })
    const wrapper = mount(PrototypeSurfaceHost, {
      attachTo: document.body,
      props: {
        context: context(),
        artifactsBySurfaceId: {
          home: { surfaceId: 'home', component: Renderer },
          dialog: { surfaceId: 'dialog', component: Renderer },
        },
        session: hydratedSession({}, ['dialog-1', 'dialog-2']),
        teleportTo: false,
      },
    })
    await nextTick()

    expect(wrapper.findAll('[data-rendered-instance]').map(node => node.attributes('data-rendered-instance')))
      .toEqual(['page-1', 'dialog-1', 'dialog-2'])
    expect(wrapper.findAll('.mx-prototype-host__overlay')).toHaveLength(2)
    expect(wrapper.get('[data-instance-id="dialog-2"]').attributes('data-top')).toBe('true')
    wrapper.unmount()
  })

  it('renders an injected Surface adapter and closes the top overlay from its button', async () => {
    const controllers = new Map<string, ControllerFixture>()
    const rendererBindings = new Map<string, Set<PrototypeVueSurfaceRendererBindings>>()
    const Renderer = defineComponent({
      name: 'TestPrototypeRenderer',
      props: {
        prototype: {
          type: Object as PropType<PrototypeVueSurfaceRendererBindings>,
          required: true,
        },
      },
      setup(rendererProps) {
        const instanceId = rendererProps.prototype.instance.instanceId
        const fixture = controllerFixture(instanceId)
        controllers.set(instanceId, fixture)
        const observedBindings = new Set<PrototypeVueSurfaceRendererBindings>()
        rendererBindings.set(instanceId, observedBindings)
        const recordBindings = () => observedBindings.add(rendererProps.prototype)
        recordBindings()
        let unregister: (() => void) | undefined
        onMounted(() => unregister = rendererProps.prototype.registerController(fixture.controller))
        onUpdated(recordBindings)
        onBeforeUnmount(() => unregister?.())
        return () => h('div', {
          'data-rendered-instance': rendererProps.prototype.instance.instanceId,
        })
      },
    })
    const artifacts: Record<string, PrototypeVueSurfaceArtifact> = {
      home: { surfaceId: 'home', component: Renderer },
      dialog: { surfaceId: 'dialog', component: Renderer },
    }
    const wrapper = mount(PrototypeSurfaceHost, {
      attachTo: document.body,
      props: {
        context: context(),
        artifactsBySurfaceId: artifacts,
        teleportTo: false,
        createInstanceId: () => 'dialog-1',
      },
    })
    await nextTick()
    const exposed = wrapper.vm as unknown as PrototypeSurfaceHostExpose
    const pageId = exposed.getSnapshot().session.pageHistory[0]!

    const opened = await exposed.activate({
      sourceInstanceId: pageId,
      sourceAddress: { nodeId: 'open', scope: [] },
      interactionId: 'open-dialog',
    })
    await nextTick()

    expect(opened.status).toBe('dispatched')
    expect(wrapper.find('[data-rendered-instance="dialog-1"]').exists()).toBe(true)
    expect(wrapper.find('.mx-prototype-host__overlay--dialog').attributes('role')).toBe('dialog')
    expect(rendererBindings.get(pageId)?.size).toBe(1)
    expect(rendererBindings.get('dialog-1')?.size).toBe(1)

    await wrapper.get('.mx-prototype-host__overlay-close').trigger('click')
    await nextTick()

    expect(exposed.getSnapshot().session.overlayStack).toEqual([])
    expect(wrapper.find('[data-rendered-instance="dialog-1"]').exists()).toBe(false)
    expect(controllers.get('dialog-1')?.calls).toContain('dialog-1:dispose')
    expect(controllers.get(pageId)?.calls).toContain(`${pageId}:focus:open`)
    wrapper.unmount()
  })
})
