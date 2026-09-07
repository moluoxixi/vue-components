import type { ResolvedBoundNode } from '@/types'
import { describe, expect, it } from 'vitest'
import { isVNode } from 'vue'
import {
  createFormRuntime,
  createReadonlyRenderContext,
  renderReadonlyValue,
  resolveReadonlyAdapter,
  resolveReadonlyAdapterKey,
} from '..'

function resolveBoundNode(component: ResolvedBoundNode['component'], field = 'name'): ResolvedBoundNode {
  const node = createFormRuntime().transformField({ component, field })
  if (!('field' in node))
    throw new Error('Expected a resolved bound node')
  return node
}

describe('readonly rendering services', () => {
  it('resolves stable keys for native and named components', () => {
    const named = { name: 'NamedInput' }

    expect(resolveReadonlyAdapterKey('input')).toBe('input')
    expect(resolveReadonlyAdapterKey(named)).toBe('NamedInput')
    expect(resolveReadonlyAdapterKey({})).toBeUndefined()
  })

  it('creates a render context from the current value snapshot', () => {
    const node = resolveBoundNode('input')
    const values = { name: 'Ada', untouched: true }

    expect(createReadonlyRenderContext(node, values)).toEqual({
      field: 'name',
      node,
      value: 'Ada',
      values,
    })
  })

  it('prefers registered component metadata and falls back to component names', () => {
    const registeredAdapter = () => 'registered'
    const namedAdapter = () => 'named'
    const registered = { ...resolveBoundNode({}), resolvedComponentKey: 'RegisteredInput' }
    const named = resolveBoundNode({ name: 'NamedInput' })
    const anonymous = resolveBoundNode({})
    const adapters = {
      NamedInput: namedAdapter,
      RegisteredInput: registeredAdapter,
    }

    expect(resolveReadonlyAdapter(adapters, registered)).toBe(registeredAdapter)
    expect(resolveReadonlyAdapter(adapters, named)).toBe(namedAdapter)
    expect(resolveReadonlyAdapter(adapters, anonymous)).toBeUndefined()
  })

  it('renders the default readonly value as stable text', () => {
    const rendered = renderReadonlyValue({ name: 'Ada' })

    expect(isVNode(rendered)).toBe(true)
    expect(rendered).toMatchObject({
      children: '{\n  "name": "Ada"\n}',
      type: 'span',
    })
  })
})
