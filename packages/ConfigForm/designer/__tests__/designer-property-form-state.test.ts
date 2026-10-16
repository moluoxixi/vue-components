import type { DesignerPropertyFormEntry } from '../src/components/DesignerPropertyPanel/types'
import type { DesignerPropertySetterDefinition } from '../src/registry'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { mount } from '@vue/test-utils'
import { ElInputNumber } from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, markRaw, nextTick } from 'vue'
import DesignerPropertyForm from '../src/components/DesignerPropertyPanel/components/DesignerPropertyForm/index.vue'

const wrappers: Array<{ unmount: () => void }> = []

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

function textSetter(key: string): DesignerPropertySetterDefinition {
  return { key, label: key, path: ['props', key], control: 'text' }
}

const CustomControl = markRaw(defineComponent({
  props: { modelValue: String, disabled: Boolean },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-custom-control': '',
      'value': props.modelValue,
      'disabled': props.disabled,
      'onInput': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    })
  },
}))

const ExplicitControl = markRaw(defineComponent({
  props: { modelValue: String, disabled: Boolean, error: String },
  emits: ['update:modelValue', 'commit'],
  setup(props, { emit }) {
    return () => h('input', {
      'data-explicit-control': '',
      'value': props.modelValue ?? '',
      'disabled': props.disabled,
      'aria-invalid': props.error ? 'true' : undefined,
      'onInput': (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      'onChange': (event: Event) => emit('commit', (event.target as HTMLInputElement).value),
    })
  },
}))

describe('property form draft and command state', () => {
  it('keeps a text draft local until blur and reprojects an accepted value', async () => {
    const setter = textSetter('Title')
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{ setter, value: 'Before' }],
        renderer: ConfigFormRenderer,
        onCommit: (value, committedSetter) => {
          void wrapper.setProps({ entries: [{ setter: committedSetter, value }] })
        },
      },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input[aria-label="Title"]')

    await input.setValue('After')
    expect(wrapper.emitted('commit')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('After')
    await input.trigger('blur')
    await nextTick()

    expect(wrapper.emitted('commit')).toEqual([['After', setter]])
    expect((input.element as HTMLInputElement).value).toBe('After')
    expect(wrapper.props('entries')[0]?.value).toBe('After')
  })

  it.each([true, false])('preserves another field draft when a command is accepted=%s', async (accepted) => {
    const title = textSetter('Title')
    const subtitle = textSetter('Subtitle')
    const original: DesignerPropertyFormEntry[] = [
      { setter: title, value: 'Title before' },
      { setter: subtitle, value: 'Subtitle before' },
    ]
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: original,
        renderer: ConfigFormRenderer,
        onCommit: (value, committedSetter) => {
          if (accepted) {
            void wrapper.setProps({ entries: original.map(entry => entry.setter.key === committedSetter.key
              ? { ...entry, value }
              : entry) })
          }
        },
      },
    })
    wrappers.push(wrapper)
    const titleInput = wrapper.get('input[aria-label="Title"]')
    const subtitleInput = wrapper.get('input[aria-label="Subtitle"]')

    await subtitleInput.setValue('Uncommitted subtitle')
    await titleInput.setValue('Title after')
    await titleInput.trigger('blur')
    await nextTick()

    expect(wrapper.emitted('commit')).toEqual([['Title after', title]])
    expect((titleInput.element as HTMLInputElement).value).toBe(accepted ? 'Title after' : 'Title before')
    expect((subtitleInput.element as HTMLInputElement).value).toBe('Uncommitted subtitle')
    expect(wrapper.props('entries')[1]?.value).toBe('Subtitle before')
  })

  it('reprojects rejected custom setter updates through the same form model', async () => {
    const setter: DesignerPropertySetterDefinition = {
      key: 'custom',
      label: 'Custom',
      path: ['props', 'custom'],
      control: 'custom',
      component: CustomControl,
    }
    const wrapper = mount(DesignerPropertyForm, {
      props: { entries: [{ setter, value: 'Accepted' }], renderer: ConfigFormRenderer },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('[data-custom-control]')

    await input.setValue('Rejected')
    await nextTick()

    expect(wrapper.emitted('commit')).toEqual([['Rejected', setter]])
    expect((input.element as HTMLInputElement).value).toBe('Accepted')
  })

  it('preserves an active draft when a different authoritative property changes', async () => {
    const title = textSetter('Title')
    const subtitle = textSetter('Subtitle')
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{ setter: title, value: 'Title before' }, { setter: subtitle, value: 'Subtitle before' }],
        renderer: ConfigFormRenderer,
      },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input[aria-label="Title"]')
    await input.setValue('Title draft')

    await wrapper.setProps({
      entries: [{ setter: title, value: 'Title before' }, { setter: subtitle, value: 'Subtitle updated' }],
    })

    expect((input.element as HTMLInputElement).value).toBe('Title draft')
    expect((wrapper.get('input[aria-label="Subtitle"]').element as HTMLInputElement).value).toBe('Subtitle updated')
    expect(wrapper.emitted('commit')).toBeUndefined()
  })

  it('does not materialize an inherited text value when it only receives focus and blur', async () => {
    const setter = textSetter('Title')
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{ setter, value: undefined, inheritedValue: 'Inherited title' }],
        renderer: ConfigFormRenderer,
      },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input[aria-label="Title"]')

    expect((input.element as HTMLInputElement).value).toBe('Inherited title')
    await input.trigger('focus')
    await input.trigger('blur')

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.props('entries')[0]?.value).toBeUndefined()
  })

  it.each(['', null])('does not rewrite an unchanged blank text value %j on blur', async (value) => {
    const setter = textSetter('Title')
    const wrapper = mount(DesignerPropertyForm, {
      props: { entries: [{ setter, value }], renderer: ConfigFormRenderer },
    })
    wrappers.push(wrapper)

    await wrapper.get('input[aria-label="Title"]').trigger('blur')

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.props('entries')[0]?.value).toBe(value)
  })

  it('keeps explicit editor drafts local and validates before committing normalized values', async () => {
    const setter = textSetter('Width')
    const entry: DesignerPropertyFormEntry = {
      setter,
      value: '80px',
      editor: {
        control: { component: ExplicitControl, trigger: 'update:modelValue' },
        commitOn: 'explicit',
        parse: value => typeof value === 'string' && /^\d+$/.test(value)
          ? { valid: true, value: `${value}px` }
          : { valid: false, message: 'Enter a number' },
      },
    }
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [entry],
        renderer: ConfigFormRenderer,
        onCommit: value => void wrapper.setProps({ entries: [{ ...entry, value }] }),
      },
    })
    wrappers.push(wrapper)
    const control = wrapper.getComponent(ExplicitControl)
    const input = wrapper.get('[data-explicit-control]')

    ;(input.element as HTMLInputElement).value = '240'
    await input.trigger('input')
    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(control.props('modelValue')).toBe('240')
    await input.trigger('change')
    await nextTick()
    expect(wrapper.emitted('commit')).toEqual([['240px', setter]])
    expect(control.props('modelValue')).toBe('240px')

    ;(input.element as HTMLInputElement).value = 'invalid'
    await input.trigger('input')
    await input.trigger('change')
    await nextTick()
    expect(wrapper.emitted('commit')).toHaveLength(1)
    expect(control.props('modelValue')).toBe('240px')
    expect(control.props('error')).toBe('Enter a number')
  })

  it('commits a reset for mixed values even when the projected value is undefined', async () => {
    const setter = textSetter('Width')
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{
          setter,
          value: undefined,
          mixed: true,
          editor: {
            control: { component: ExplicitControl, trigger: 'update:modelValue' },
            commitOn: 'explicit',
          },
        }],
        renderer: ConfigFormRenderer,
      },
    })
    wrappers.push(wrapper)

    wrapper.getComponent(ExplicitControl).vm.$emit('commit', undefined)
    await nextTick()

    expect(wrapper.emitted('commit')).toEqual([[undefined, setter]])
  })

  it('keeps drafts attached to their property path when entries are reordered', async () => {
    const title = { setter: textSetter('Title'), value: 'Title before' }
    const subtitle = { setter: textSetter('Subtitle'), value: 'Subtitle before' }
    const wrapper = mount(DesignerPropertyForm, {
      props: { entries: [title, subtitle], renderer: ConfigFormRenderer },
    })
    wrappers.push(wrapper)
    await wrapper.get('input[aria-label="Title"]').setValue('Title draft')

    await wrapper.setProps({ entries: [subtitle, title] })

    expect((wrapper.get('input[aria-label="Title"]').element as HTMLInputElement).value).toBe('Title draft')
    expect((wrapper.get('input[aria-label="Subtitle"]').element as HTMLInputElement).value).toBe('Subtitle before')
    expect(wrapper.emitted('commit')).toBeUndefined()
  })

  it('discards a previous selection draft even when the next selection has the same value', async () => {
    const setter = textSetter('Title')
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{ setter, value: 'Shared title' }],
        node: { id: 'first', kind: 'element', component: 'test.text', props: {} },
        renderer: ConfigFormRenderer,
      },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input[aria-label="Title"]')
    await input.setValue('First selection draft')

    await wrapper.setProps({ node: { id: 'second', kind: 'element', component: 'test.text', props: {} } })

    expect((input.element as HTMLInputElement).value).toBe('Shared title')
    expect(wrapper.emitted('commit')).toBeUndefined()
  })

  it('ignores control emissions while readonly, including custom setters', async () => {
    const count: DesignerPropertySetterDefinition = {
      key: 'count',
      label: 'Count',
      path: ['props', 'count'],
      control: 'number',
    }
    const custom: DesignerPropertySetterDefinition = {
      key: 'custom',
      label: 'Custom',
      path: ['props', 'custom'],
      control: 'custom',
      component: CustomControl,
    }
    const wrapper = mount(DesignerPropertyForm, {
      props: {
        entries: [{ setter: count, value: 1 }, { setter: custom, value: 'Before' }],
        renderer: ConfigFormRenderer,
        readonly: true,
      },
    })
    wrappers.push(wrapper)

    expect(wrapper.getComponent(ElInputNumber).props('disabled')).toBe(true)
    expect(wrapper.getComponent(CustomControl).props('disabled')).toBe(true)
    wrapper.getComponent(ElInputNumber).vm.$emit('change', 2)
    wrapper.getComponent(CustomControl).vm.$emit('update:modelValue', 'After')
    await nextTick()

    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.props('entries').map(entry => entry.value)).toEqual([1, 'Before'])
    expect((wrapper.get('[data-custom-control]').element as HTMLInputElement).value).toBe('Before')
  })
})
