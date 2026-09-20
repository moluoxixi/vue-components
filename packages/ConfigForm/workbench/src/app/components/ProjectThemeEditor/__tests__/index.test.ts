// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { ElColorPicker } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick, reactive } from 'vue'
import ProjectThemeEditor from '../index.vue'

describe('project theme editor', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="workbench-overlays"></div>'
  })

  afterEach(() => document.body.replaceChildren())

  it('applies a detached theme after editing reactive color state', async () => {
    const source = reactive({ version: 1 as const, colors: { primary: '#123456' } })
    const wrapper = mount(ProjectThemeEditor, { props: { modelValue: source } })

    wrapper.findComponent(ElColorPicker).vm.$emit('update:modelValue', '#654321')
    await nextTick()
    const apply = wrapper.findAll('button').find(button => button.text().includes('Apply'))
    expect(apply).toBeDefined()
    await apply!.trigger('click')

    const emitted = wrapper.emitted('apply')?.[0]?.[0]
    expect(emitted).toMatchObject({ version: 1, colors: { primary: '#654321' } })
    expect(emitted).not.toBe(source)
    wrapper.unmount()
  })
})
