import type { ReadonlyAdapter } from '../types'
import type { FormNodeConfig } from '@/types'
import { describe, expect, it } from 'vitest'
import { createFormRuntime } from '../createFormRuntime'
import { resolveReadonlyAdapter } from '../readonly'

describe('readonly component aliases', () => {
  it('preserves a registered component key for readonly adapter lookup', () => {
    const AnonymousInput = {}
    const adapter: ReadonlyAdapter = ({ value }) => String(value)
    const runtime = createFormRuntime({
      components: { AliasInput: AnonymousInput },
      readonlyAdapters: { AliasInput: adapter },
    })
    const node = runtime.transformField({
      component: 'AliasInput',
      field: 'name',
    })
    if (!('field' in node))
      throw new Error('Expected a resolved bound node')

    expect(node.resolvedComponentKey).toBe('AliasInput')
    expect(resolveReadonlyAdapter(runtime.readonlyAdapters, node)).toBe(adapter)
  })

  it('does not add registry metadata to native tags or direct components', () => {
    const runtime = createFormRuntime()
    const nativeNode = runtime.transformField({ component: 'input', field: 'native' })
    const componentNode = runtime.transformField({ component: {}, field: 'direct' })

    expect(nativeNode).not.toHaveProperty('resolvedComponentKey')
    expect(componentNode).not.toHaveProperty('resolvedComponentKey')
  })

  it('removes untrusted or stale registry metadata before resolving a direct component', () => {
    const runtime = createFormRuntime()
    const polluted = {
      component: 'input',
      field: 'name',
      resolvedComponentKey: 'StaleAlias',
    } as unknown as FormNodeConfig
    const node = runtime.transformField(polluted)

    expect(node).not.toHaveProperty('resolvedComponentKey')
  })

  it('supports an explicitly registered empty-string alias', () => {
    const adapter: ReadonlyAdapter = ({ value }) => String(value)
    const runtime = createFormRuntime({
      components: { '': {} },
      readonlyAdapters: { '': adapter },
    })
    const node = runtime.transformField({ component: '', field: 'name' })
    if (!('field' in node))
      throw new Error('Expected a resolved bound node')

    expect(node.resolvedComponentKey).toBe('')
    expect(resolveReadonlyAdapter(runtime.readonlyAdapters, node)).toBe(adapter)
  })
})
