// @vitest-environment happy-dom
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { RuntimeHostRuntimeStatePayload, RuntimeHostSyncMessage, RuntimeHostToParentMessage } from '..'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { isParentToRuntimeHostMessage, isRuntimeHostToParentMessage, RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '..'
import { compileScopedFixture, nestedValues, scopedGraph } from '../../session/__tests__/preview-instance-fixture'
import { createPreviewSession } from '../../session/services/preview'
import RuntimeHostApp from '../index.vue'

const adapter = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../../adapters', () => ({ loadWorkbenchRuntimeAdapter: adapter.load }))

describe('real RuntimeHost instance bridge', () => {
  it('keeps live row identities, mirrors scoped field changes, and restores metadata onto fresh Renderer row IDs', async () => {
    const fixture = compileScopedFixture()
    adapter.load.mockResolvedValue({ runtimeResolver: fixture.resolver })
    const session = createPreviewSession()
    session.accept(fixture.input)
    session.updateRuntimeModel(nestedValues())
    const messages: RuntimeHostToParentMessage[] = []
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation((payload) => {
      expect(isRuntimeHostToParentMessage(payload)).toBe(true)
      const message = payload as RuntimeHostToParentMessage
      messages.push(message)
      if (message.type === 'mounted')
        session.handleRuntimeMounted(message)
      if (message.type === 'ready')
        session.handleRuntimeReady(message)
      if (message.type === 'runtimeState')
        session.handleRuntimeState({ ...message, state: message.payload })
      if (message.type === 'fieldChange')
        session.handleFieldChange({ ...message, ...message.payload })
    })
    const wrapper = mount(RuntimeHostApp)
    let sequence = 0
    const dispatch = (payload: Record<string, unknown>) => {
      const message = {
        channel: RUNTIME_HOST_CHANNEL,
        version: RUNTIME_HOST_PROTOCOL_VERSION,
        hostId: 'real-host',
        pageId: 'home',
        projectId: 'scoped-preview',
        revision: session.revisionKey.value,
        sequence: ++sequence,
        ...payload,
      }
      expect(isParentToRuntimeHostMessage(message)).toBe(true)
      window.dispatchEvent(new MessageEvent('message', { data: message, source: window.parent, origin: window.location.origin }))
    }
    const sync = (compiled = fixture) => dispatch({
      type: 'sync',
      adapter: 'element-plus',
      compilation: compiled.compilation,
      locale: 'en-US',
      mode: 'preview',
      runtimeSessionKey: 'scoped-preview:element-plus:home',
      runtimeState: session.runtimeState.value,
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
    } satisfies Omit<RuntimeHostSyncMessage, 'channel' | 'version' | 'hostId' | 'pageId' | 'projectId' | 'revision' | 'sequence'>)
    const renderer = () => wrapper.getComponent({ name: 'ConfigFormRenderer' }).vm as unknown as ConfigFormRendererExpose<Record<string, unknown>>
    const latestState = (): RuntimeHostRuntimeStatePayload => {
      const message = messages.findLast(message => message.type === 'runtimeState')
      if (!message || message.type !== 'runtimeState')
        throw new Error('No runtime state received.')
      return message.payload
    }
    try {
      sync()
      await vi.waitFor(() => expect(messages.some(message => message.type === 'runtimeState')).toBe(true))
      expect(renderer().getValues()).toEqual(nestedValues())
      expect(latestState().fields).toEqual(renderer().listFieldInstances().map(instance => ({ ...instance.address, instanceKey: instance.instanceKey, valuePath: instance.valuePath })))
      const billing = wrapper.findAll('input').find(input => input.element.value === 'Billing')!
      await billing.setValue('Billing edited')
      await flushPromises()
      expect(session.values.value.billing).toMatchObject({ name: 'Billing edited' })
      expect(messages.filter(message => message.type === 'fieldChange').at(-1)).toMatchObject({ payload: {
        nodeId: 'billing-name',
        scope: [],
        valuePath: ['billing', 'name'],
        instanceKey: expect.any(String),
      } })
      const item = renderer().listFieldInstances('item-name').find(instance => instance.value === 'A2')!
      renderer().setInstanceValue(item.address, '')
      renderer().setInstanceTouched(item.address, true)
      expect(await renderer().validateInstance(item.address)).toBe(false)
      const outer = renderer().listRows('groups')[0]!
      const inner = renderer().listRows('items', outer.scope)
      renderer().moveRow('groups', outer.rowId, 1)
      renderer().moveRow('items', inner[1]!.rowId, 0, outer.scope)
      renderer().removeRow('items', inner[0]!.rowId, outer.scope)
      await flushPromises()
      const before = latestState()
      expect(before.fields.find(field => field.instanceKey === item.instanceKey)?.valuePath).toEqual(['groups', 1, 'items', 0, 'name'])
      expect(before.touched).toContain(item.instanceKey)
      expect(before.validation[item.instanceKey]).toEqual(['item-name required'])
      const ids = renderer().listFieldInstances().map(instance => instance.instanceKey)
      dispatch({ type: 'state', runtimeState: { ...before, values: nestedValues() }, reactionProjection: { values: {}, props: {}, states: {}, validate: [] } })
      await nextTick()
      expect(renderer().getValues()).toEqual(before.values)
      expect(renderer().listFieldInstances().map(instance => instance.instanceKey)).toEqual(ids)
      sync()
      await flushPromises()
      expect(renderer().listFieldInstances().map(instance => instance.instanceKey)).toEqual(ids)
      const graph = scopedGraph()
      graph.nodesById['billing-name']!.props.placeholder = 'Recompiled'
      const next = compileScopedFixture(graph, 1)
      session.accept(next.input)
      adapter.load.mockResolvedValue({ runtimeResolver: next.resolver })
      sync(next)
      await vi.waitFor(() => expect(messages.some(message => message.type === 'runtimeState' && message.revision === session.revisionKey.value)).toBe(true))
      const restored = renderer().listFieldInstances('item-name').find(instance => instance.valuePath.join('/') === 'groups/1/items/0/name')!
      expect(restored.instanceKey).not.toBe(item.instanceKey)
      expect(renderer().getValues()).toEqual(before.values)
      expect(renderer().getInstanceMeta(restored.address).touched).toBe(true)
      expect(renderer().getInstanceErrors(restored.address)).toEqual(['item-name required'])
      expect(latestState().touched).toContain(restored.instanceKey)
      expect(latestState().touched).not.toContain(item.instanceKey)
      expect(latestState().validation[restored.instanceKey]).toEqual(['item-name required'])
      expect(JSON.stringify(renderer().getValues())).not.toContain('row-')
      expect(messages.filter(message => message.type === 'error')).toEqual([])
    }
    finally {
      wrapper.unmount()
      session.dispose()
      postMessage.mockRestore()
    }
  })
})
