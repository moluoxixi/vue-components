import type { ConfigFormDefaultSlotContext } from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type { ConfigFormRendererExpose } from '../types'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, shallowRef } from 'vue'
import { ConfigFormRenderer } from '../index'

describe('form experience presentation', () => {
  it('links help and warnings to the control and respects density and explicit gaps', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [
          {
            id: 'name',
            field: 'name',
            component: 'input',
            label: 'Name',
            description: 'Full name',
            help: 'Use your legal name',
            warning: 'Check spelling',
          },
        ],
        model: createConfigFormModel(shallowRef({ name: '' })),
        density: 'compact',
      },
    })
    expect(wrapper.get('input').attributes('aria-describedby')).toBe(
      wrapper.get('[data-config-form-supporting]').attributes('id'),
    )
    expect(wrapper.get('[data-config-form-description]').text()).toBe('Full name')
    expect(wrapper.get('[data-config-form-warning]').text()).toBe('Check spelling')
    expect(wrapper.get('[data-config-form-responsive-layout]').attributes('style')).toContain('gap: 8px')
    await wrapper.setProps({ gap: '20px' })
    expect(wrapper.get('[data-config-form-responsive-layout]').attributes('style')).toContain('gap: 20px')
    wrapper.unmount()
  })

  it('reveals the invalid repeated instance on submit and on summary activation', async () => {
    const values = shallowRef({ items: [{ name: 'Valid' }, { name: '' }] })
    const wrapper = mount(ConfigFormRenderer as Component, {
      attachTo: document.body,
      props: {
        fields: [
          {
            id: 'items',
            component: 'section',
            valueScope: { kind: 'array', field: 'items', minItems: 0 },
            slots: { default: [{ id: 'name', field: 'name', component: 'input', label: 'Name', required: true }] },
          },
        ],
        model: createConfigFormModel(values),
        errorSummary: true,
      },
    })
    const controls = wrapper.findAll('[data-field="name"] input')
    const scroll = vi.fn()
    const invalidShell = wrapper.findAll('[data-field="name"]')[1]!.element as HTMLElement
    invalidShell.scrollIntoView = scroll
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    expect(await api.submit()).toBe(false)
    expect(document.activeElement).toBe(controls[1]!.element)
    expect(scroll).toHaveBeenCalled()
    const summary = wrapper.get('[data-config-form-error-summary]')
    expect(summary.text()).toContain('items.1.name')
    ;(controls[0]!.element as HTMLElement).focus()
    await summary.get('button').trigger('click')
    expect(document.activeElement).toBe(controls[1]!.element)
    api.setInstanceValue(api.listFieldInstances('name')[1]!.address, 'Corrected')
    expect(await api.submit()).toBe(true)
    expect(wrapper.find('[data-config-form-error-summary]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('allows focus opt-out and passes submit/reset into a sticky actions slot', async () => {
    const wrapper = mount(ConfigFormRenderer as Component, {
      props: {
        fields: [{ id: 'name', field: 'name', component: 'input', required: true }],
        model: createConfigFormModel(shallowRef({ name: '' })),
        focusFirstError: false,
        stickyActions: true,
      },
      slots: {
        actions: ({ submit, resetFields }: ConfigFormDefaultSlotContext) => [
          h('button', { type: 'button', onClick: submit }, 'Submit'),
          h('button', { type: 'button', onClick: resetFields }, 'Reset'),
        ],
      },
    })
    const api = wrapper.vm as unknown as ConfigFormRendererExpose
    const focus = vi.spyOn(wrapper.get('input').element as HTMLElement, 'focus')
    expect(await api.submit()).toBe(false)
    expect(focus).not.toHaveBeenCalled()
    expect(wrapper.get('[data-config-form-actions]').attributes('data-sticky')).toBe('true')
    api.setValue('name', 'Edited')
    await wrapper.get('[data-config-form-actions] button:last-child').trigger('click')
    expect(api.getValue('name')).toBe('')
    wrapper.unmount()
  })
})
