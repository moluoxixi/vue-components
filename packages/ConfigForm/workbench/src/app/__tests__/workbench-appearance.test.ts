// @vitest-environment happy-dom

import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import {
  WorkbenchAppearanceDrawer,
  WorkbenchAppearancePanel,
  WorkbenchAppearancePopover,
} from '../components'

function overlayRoot(): DOMWrapper<Element> {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
}

describe('workbench appearance controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="return-focus">Open</button><div id="workbench-overlays" class="workbench-overlays" data-theme="light" data-palette="catppuccin"></div>'
  })

  afterEach(() => document.body.replaceChildren())

  it('offers all modes and palettes and emits immediate selections', async () => {
    const wrapper = mount(WorkbenchAppearancePanel, {
      props: {
        paletteFamily: 'catppuccin',
        themePreference: 'system',
      },
    })

    expect(wrapper.findAll('.appearance-mode-control .el-segmented__item')).toHaveLength(3)
    expect(wrapper.findAll('.appearance-palette-option')).toHaveLength(4)
    expect(wrapper.text()).toContain('System')
    expect(wrapper.text()).toContain('Rosé Pine')

    await wrapper.find('input[value="kanagawa"]').setValue()
    expect(wrapper.emitted('setPaletteFamily')).toEqual([['kanagawa']])
    wrapper.unmount()
  })

  it('uses the settings icon for the desktop popover trigger', () => {
    const wrapper = mount(WorkbenchAppearancePopover, {
      props: {
        paletteFamily: 'gruvbox',
        themePreference: 'dark',
      },
    })
    expect(wrapper.get('button[aria-label="Open appearance settings"]')).toBeDefined()
    wrapper.unmount()
  })

  it('closes the mobile drawer and restores the invoking control', async () => {
    const trigger = document.getElementById('return-focus') as HTMLButtonElement
    trigger.focus()
    const wrapper = mount(WorkbenchAppearanceDrawer, {
      attachTo: document.body,
      props: {
        open: false,
        paletteFamily: 'rose-pine',
        themePreference: 'system',
      },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    expect(overlayRoot().get('.appearance-panel').text()).toContain('Rosé Pine')
    await overlayRoot().get('button[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    await nextTick()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })
})
