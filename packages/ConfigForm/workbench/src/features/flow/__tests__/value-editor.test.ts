// @vitest-environment happy-dom
import type { ConfigFormValueInput } from '@moluoxixi/config-form-core'
import type { VueWrapper } from '@vue/test-utils'
import type { Component, ShallowRef } from 'vue'
import type { ValueEditorProps } from '../components/FlowWorkspace/components/ValueEditor'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { ValueEditor } from '../components/FlowWorkspace/components/ValueEditor'

const fields = [{ nodeId: 'email-node', field: 'email', label: 'Email address' }]
const eventArguments = [{ value: 'payload', label: 'Payload value', path: ['args', '0', 'payload.value'] }]
const outputs = [{
  key: 'load:data',
  label: 'Load data',
  value: { $ref: { kind: 'output' as const, stepId: 'load-step', path: ['data', 'items'] } },
}]
const variables = [{ value: 'customer-variable', label: 'Customer' }]
const dataSources = [{ value: 'customer-source', label: 'Customers' }]
const locale = createDesignerLocale()

function mountEditor(
  initialValue: ConfigFormValueInput,
  overrides: Partial<Pick<ValueEditorProps, 'allowReferences' | 'control'>> = {},
): { model: ShallowRef<ConfigFormValueInput>, wrapper: VueWrapper } {
  const model = shallowRef<ConfigFormValueInput>(initialValue)
  const Harness = defineComponent({
    setup() {
      return () => {
        const componentProps: Record<string, unknown> = {
          modelValue: model.value,
          fields,
          eventArguments,
          outputs,
          variables,
          dataSources,
          locale,
          ...overrides,
        }
        componentProps['onUpdate:modelValue'] = (value: ConfigFormValueInput) => model.value = value
        return h(ValueEditor as Component, componentProps)
      }
    },
  })
  return { model, wrapper: mount(Harness) }
}

function sourceControls(wrapper: VueWrapper): VueWrapper[] {
  return wrapper.findAllComponents('.flow-value-source') as unknown as VueWrapper[]
}

function sourceControl(wrapper: VueWrapper, index = 0): VueWrapper {
  return sourceControls(wrapper)[index]!
}

async function chooseSource(wrapper: VueWrapper, source: string): Promise<void> {
  sourceControl(wrapper).vm.$emit('change', source)
  await nextTick()
}

beforeEach(() => {
  const overlays = document.createElement('div')
  overlays.id = 'workbench-overlays'
  document.body.append(overlays)
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('flow value editor stable references', () => {
  it('creates and reads every dynamic ConfigFormValueInput reference kind', async () => {
    const { model, wrapper } = mountEditor('')

    await chooseSource(wrapper, 'field')
    expect(model.value).toEqual({ $ref: { kind: 'field', nodeId: 'email-node' } })
    expect((sourceControl(wrapper).props() as Record<string, unknown>).modelValue).toBe('field')

    await chooseSource(wrapper, 'variable')
    expect(model.value).toEqual({ $ref: { kind: 'variable', variableId: 'customer-variable' } })
    expect((sourceControl(wrapper).props() as Record<string, unknown>).modelValue).toBe('variable')

    await chooseSource(wrapper, 'event')
    expect(model.value).toEqual({ $ref: { kind: 'event', path: ['args', '0', 'payload.value'] } })
    expect((sourceControl(wrapper).props() as Record<string, unknown>).modelValue).toBe('event')

    await chooseSource(wrapper, 'output')
    expect(model.value).toEqual({ $ref: { kind: 'output', stepId: 'load-step', path: ['data', 'items'] } })
    expect((sourceControl(wrapper).props() as Record<string, unknown>).modelValue).toBe('output')

    await chooseSource(wrapper, 'expression')
    await wrapper.get('input[aria-label="Advanced expression"]').setValue('$variables["customer-variable"]')
    await nextTick()
    expect(model.value).toEqual({
      $ref: { kind: 'expression', source: '$variables["customer-variable"]' },
    })

    await chooseSource(wrapper, 'static')
    expect(model.value).toBe('')
  })

  it('uses field names for literal field controls while source references use node ids', async () => {
    const sourceEditor = mountEditor('')
    await chooseSource(sourceEditor.wrapper, 'field')
    expect(sourceEditor.model.value).toEqual({ $ref: { kind: 'field', nodeId: 'email-node' } })

    const literalEditor = mountEditor('', { allowReferences: false, control: 'field' })
    const fieldSelect = literalEditor.wrapper.findComponent({ name: 'ElSelect' }) as VueWrapper
    fieldSelect.vm.$emit('change', 'email')
    await nextTick()
    expect(literalEditor.model.value).toBe('email')
  })

  it('keeps intentional nested references dynamic in structured objects', async () => {
    const { model, wrapper } = mountEditor({ recipient: '' })
    expect(sourceControls(wrapper)).toHaveLength(2)

    sourceControl(wrapper, 1).vm.$emit('change', 'field')
    await nextTick()

    expect(model.value).toEqual({
      recipient: { $ref: { kind: 'field', nodeId: 'email-node' } },
    })
  })

  it('escapes literal objects containing the reserved $ref key and keeps them structured', async () => {
    const { model, wrapper } = mountEditor({ key1: '' })
    const keyInput = wrapper.get('input[aria-label="Property name"]')
    await keyInput.setValue('$ref')
    await keyInput.trigger('change')
    await nextTick()

    expect(model.value).toEqual({
      $ref: {
        kind: 'literal',
        value: { $ref: '' },
      },
    })
    expect((sourceControl(wrapper).props() as Record<string, unknown>).modelValue).toBe('static')
    expect(wrapper.find('.flow-structured-list.is-object').exists()).toBe(true)
    expect(sourceControls(wrapper)).toHaveLength(1)
  })

  it('reads an imported literal wrapper without interpreting nested reference-shaped data', () => {
    const { wrapper } = mountEditor({
      $ref: {
        kind: 'literal',
        value: {
          $ref: { kind: 'field', nodeId: 'literal-node' },
        },
      },
    })

    expect((sourceControl(wrapper).props() as Record<string, unknown>).modelValue).toBe('static')
    expect(wrapper.find('.flow-structured-list.is-object').exists()).toBe(true)
    expect(sourceControls(wrapper)).toHaveLength(1)
  })
})
