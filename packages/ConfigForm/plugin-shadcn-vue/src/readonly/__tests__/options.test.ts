import type { ReadonlyRenderContext } from '@moluoxixi/config-form/plugins'
import { defineField } from '@moluoxixi/config-form'
import { createFormRuntime } from '@moluoxixi/config-form/plugins'
import { describe, expect, it } from 'vitest'
import { isVNode } from 'vue'
import { createShadcnVuePlugin } from '../../index'
import { createShadcnChoiceReadonlyAdapter } from '../adapters'

describe('shadcn readonly options', () => {
  it('falls back to raw values when options are missing', () => {
    const adapter = createShadcnChoiceReadonlyAdapter()
    const runtime = createFormRuntime({
      plugins: [createShadcnVuePlugin({
        components: { NativeSelect: { name: 'NativeSelect' } },
      })],
    })
    const node = runtime.transformField(defineField({
      component: 'NativeSelect',
      field: 'plan',
    }))
    if (!('field' in node))
      throw new Error('Expected a resolved bound node')
    const context = {
      field: 'plan',
      node,
      value: 'pro',
      values: { plan: 'pro' },
    } satisfies ReadonlyRenderContext
    const rendered = adapter(context)

    expect(isVNode(rendered)).toBe(true)
    if (isVNode(rendered))
      expect(rendered.children).toBe('pro')
  })

  it('falls back to raw values when options are not an array', () => {
    const adapter = createShadcnChoiceReadonlyAdapter()
    const runtime = createFormRuntime({
      plugins: [createShadcnVuePlugin({
        components: { NativeSelect: { name: 'NativeSelect' } },
      })],
    })
    const node = runtime.transformField(defineField({
      component: 'NativeSelect',
      field: 'plan',
      props: { options: { pro: 'Professional' } },
    }))
    if (!('field' in node))
      throw new Error('Expected a resolved bound node')
    const context = {
      field: 'plan',
      node,
      value: 'pro',
      values: { plan: 'pro' },
    } satisfies ReadonlyRenderContext
    const rendered = adapter(context)

    expect(isVNode(rendered)).toBe(true)
    if (isVNode(rendered))
      expect(rendered.children).toBe('pro')
  })

  it('ignores malformed option entries', () => {
    const adapter = createShadcnChoiceReadonlyAdapter()
    const runtime = createFormRuntime({
      plugins: [createShadcnVuePlugin({
        components: { NativeSelect: { name: 'NativeSelect' } },
      })],
    })
    const node = runtime.transformField(defineField({
      component: 'NativeSelect',
      field: 'plan',
      props: {
        options: [null, 'invalid', { label: 'Professional', value: 'pro' }],
      },
    }))
    if (!('field' in node))
      throw new Error('Expected a resolved bound node')
    const rendered = adapter({
      field: 'plan',
      node,
      value: 'pro',
      values: { plan: 'pro' },
    })

    expect(isVNode(rendered)).toBe(true)
    if (isVNode(rendered))
      expect(rendered.children).toBe('Professional')
  })
})
