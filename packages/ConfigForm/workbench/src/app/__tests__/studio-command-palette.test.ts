// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import type { StudioCommand } from '../types/studio-command'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudioCommandPalette from '../components/StudioCommandPalette.vue'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

function command(id: string, disabled = false): StudioCommand {
  return { id, label: id, group: 'Project', disabled, disabledReason: disabled ? 'No changes to save.' : undefined, run: vi.fn() }
}

function render(commands: StudioCommand[]) {
  const wrapper = mount(StudioCommandPalette, {
    attachTo: document.body,
    props: { open: true, commands, locale: 'en-US' },
    global: { stubs: { ElDialog: { template: '<section><slot /></section>' } } },
  })
  wrappers.push(wrapper)
  return wrapper
}

function selected(wrapper: VueWrapper): string | undefined {
  return wrapper.find('[role="option"][aria-selected="true"]').exists()
    ? wrapper.get('[role="option"][aria-selected="true"] strong').text()
    : undefined
}

describe('studio command navigation', () => {
  it('selects and wraps through available commands while exposing disabled reasons', async () => {
    const commands = [command('Save', true), command('Design'), command('Undo', true), command('Experience')]
    const wrapper = render(commands)
    const input = wrapper.get('[role="combobox"]')
    expect(selected(wrapper)).toBe('Design')
    expect(wrapper.get('[aria-disabled="true"] .studio-command-reason').text()).toBe('No changes to save.')
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(selected(wrapper)).toBe('Experience')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(selected(wrapper)).toBe('Design')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(selected(wrapper)).toBe('Experience')
    await wrapper.get('[aria-disabled="true"]').trigger('click')
    expect(wrapper.emitted('update:open')).toBeUndefined()
    await input.trigger('keydown', { key: 'Enter' })
    expect(commands[3]!.run).toHaveBeenCalledOnce()
    expect(commands[0]!.run).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('keeps the active command stable on reorder and finds a valid replacement on removal or disabling', async () => {
    const design = command('Design')
    const experience = command('Experience')
    const wrapper = render([design, experience])
    const input = wrapper.get('[role="combobox"]')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.setProps({ commands: [experience, design] })
    expect(selected(wrapper)).toBe('Experience')
    await wrapper.setProps({ commands: [design, { ...experience, disabled: true }] })
    expect(selected(wrapper)).toBe('Design')
    await wrapper.setProps({ commands: [{ ...experience, disabled: true }] })
    expect(selected(wrapper)).toBeUndefined()
    expect(input.attributes('aria-activedescendant')).toBeUndefined()
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(experience.run).not.toHaveBeenCalled()
  })

  it('recovers an empty search and returns focus to the combobox', async () => {
    const wrapper = render([command('Design'), command('Save', true)])
    const input = wrapper.get('[role="combobox"]')
    await input.setValue('unmatched')
    expect(input.attributes('aria-activedescendant')).toBeUndefined()
    expect(wrapper.get('.studio-command-empty').text()).toContain('Try a component, page name or action.')
    await wrapper.get('.studio-command-empty button').trigger('click')
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(input.element)
    expect(selected(wrapper)).toBe('Design')
    expect(wrapper.get(`#${input.attributes('aria-activedescendant')}`).attributes('aria-selected')).toBe('true')
  })

  it('waits for IME composition before executing Enter', async () => {
    const design = command('Design')
    const wrapper = render([design])
    const input = wrapper.get('[role="combobox"]')
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    expect(design.run).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    await input.trigger('keydown', { key: 'Enter' })
    expect(design.run).toHaveBeenCalledOnce()
  })
})
