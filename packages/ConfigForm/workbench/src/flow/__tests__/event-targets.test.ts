// @vitest-environment happy-dom
import type {
  DesignerDocument,
  LowCodeComponentDefinition,
  LowCodeComponentRegistry,
} from '@moluoxixi/config-form-designer'
import { describe, expect, it } from 'vitest'
import { collectFlowEventTargets, flowEventTargetKey } from '../event-targets'

function registryFor(definitions: LowCodeComponentDefinition[]): LowCodeComponentRegistry {
  const byComponent = new Map(definitions.map(definition => [definition.component, definition]))
  return { get: component => byComponent.get(component) } as LowCodeComponentRegistry
}

describe('flow event targets', () => {
  it('projects registered events from nested page nodes in stable traversal order', () => {
    const registry = registryFor([
      { component: 'section', displayName: 'Section', events: [] } as unknown as LowCodeComponentDefinition,
      {
        component: 'input',
        displayName: 'Input',
        events: [{ name: 'update:modelValue', displayName: 'Value change' }],
      } as unknown as LowCodeComponentDefinition,
      {
        component: 'select',
        displayName: 'Select',
        events: [{ name: 'change', displayName: 'Change' }],
      } as unknown as LowCodeComponentDefinition,
    ])
    const document = {
      version: 1,
      form: {},
      nodes: [{
        id: 'section',
        kind: 'container',
        material: 'section',
        slots: {
          default: [
            { id: 'name', kind: 'field', material: 'input', field: 'name', label: 'Name' },
            { id: 'role', kind: 'field', material: 'select', field: 'role' },
          ],
        },
      }],
    } as unknown as DesignerDocument

    expect(collectFlowEventTargets(document, registry)).toEqual([
      { nodeId: 'name', nodeLabel: 'Name', component: 'input', event: 'update:modelValue', eventLabel: 'Value change' },
      { nodeId: 'role', nodeLabel: 'role', component: 'select', event: 'change', eventLabel: 'Change' },
    ])
  })

  it('uses node and event as a collision-safe selector key', () => {
    expect(flowEventTargetKey({ nodeId: 'a:b', event: 'update:modelValue' }))
      .toBe(JSON.stringify(['a:b', 'update:modelValue']))
  })
})
