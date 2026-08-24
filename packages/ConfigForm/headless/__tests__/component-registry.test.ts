import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import {
  createConfigFormComponentMaterialRegistry,
  createConfigFormComponentRegistry,
  defineConfigFormComponentMaterial,
} from '../index'

describe('config-form component material registry', () => {
  it('creates the existing semantic component registry shape from modules', () => {
    const Input = defineComponent(() => () => h('input'))
    const modules = {
      './materials/text.ts': defineConfigFormComponentMaterial({
        name: 'text',
        order: 10,
        value: { component: Input, trigger: 'change', valueProp: 'value' },
      }),
    }

    expect(createConfigFormComponentRegistry(modules)).toEqual({
      text: { component: Input, trigger: 'change', valueProp: 'value' },
    })
    expect(createConfigFormComponentMaterialRegistry(modules).list()[0]).toMatchObject({
      name: 'text',
      order: 10,
      source: './materials/text.ts',
    })
  })

  it('accepts a direct component without changing the registry contract', () => {
    const Input = defineComponent(() => () => h('input'))
    const registry = createConfigFormComponentRegistry({
      './materials/text.ts': { name: 'text', value: Input },
    })

    expect(registry.text).toBe(Input)
  })
})
