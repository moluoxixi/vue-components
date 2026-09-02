import { describe, expect, it } from 'vitest'
import { collectFlowEventTargets, flowEventTargetKey } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createBuiltInProjectFixture } from '../../project/__tests__/fixtures'

describe('flow event targets', () => {
  it.each([
    {
      adapterId: 'element-plus' as const,
      templateId: 'element-profile' as const,
      events: ['update:modelValue', 'update:modelValue', 'update:modelValue'],
    },
    {
      adapterId: 'antd-vue' as const,
      templateId: 'antd-profile' as const,
      events: ['update:value', 'update:value', 'update:checked'],
    },
  ])('projects $adapterId binding events with user-facing labels and canonical names', async ({ adapterId, events, templateId }) => {
    const adapter = await loadWorkbenchAdapter(adapterId)
    const project = createBuiltInProjectFixture(
      templateId,
      { id: 'event-project', name: 'Event project' },
      adapter.componentRegistry.lock,
    )
    const page = project.pagesById[project.homePageId]!

    const targets = collectFlowEventTargets(
      page.graph,
      adapter.componentRegistry,
      adapter.designerRegistry,
    )
    expect(targets.map(target => target.event)).toEqual(events)
    expect(targets.map(target => target.eventLabel)).toEqual(['Value change', 'Value change', 'Value change'])
    expect(targets.map(target => target.nodeId)).toEqual([
      'profile-name-node-1',
      'profile-role-node-2',
      'profile-active-node-3',
    ])
  }, 10_000)

  it('uses node and event as a collision-safe selector key', () => {
    expect(flowEventTargetKey({ nodeId: 'a:b', event: 'update:modelValue' }))
      .toBe(JSON.stringify(['a:b', 'update:modelValue']))
  })
})
