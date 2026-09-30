// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createDesignerDragController, DESIGNER_SESSION_KEY } from '../src/components/DesignerCanvas/services'
import DesignerPalette from '../src/components/DesignerPalette'
import { useDesignerPaletteDrag } from '../src/components/DesignerPalette/composables'
import { createDesignerRegistry } from '../src/registry'

const registry = createDesignerRegistry({ materials: [{
  key: 'test.input',
  version: 1,
  kind: 'field',
  category: 'Fields',
  title: 'A very long customer account identifier field',
  runtime: { component: 'input' },
  source: { configComponent: 'text', render: 'component', tag: 'input' },
  setters: [],
  createNode: ({ id, field = 'input' }) => ({ id, field, kind: 'field', component: 'test.input' }),
}] })

describe('designer palette presentation', () => {
  it('renders only a registry icon or fallback and the complete display name', () => {
    const [material] = registry.listMaterials()
    const wrapper = mount(DesignerPalette, {
      props: { materials: [material!], registry },
    })

    const row = wrapper.get('[data-material-row-key="test.input"]')
    expect(row.get('.mx-config-form-designer__palette-icon').text()).toBe('F')
    expect(row.get('.mx-config-form-designer__palette-item-name').text()).toBe(material!.title)
    expect(row.get('button').attributes('aria-label')).toBe(material!.title)
    expect(row.find('[data-specimen-node-id]').exists()).toBe(false)
    expect(row.find('input').exists()).toBe(false)
  })

  it('lets an embedding shell own the single material search input', () => {
    const wrapper = mount(DesignerPalette, {
      props: {
        materials: registry.listMaterials(),
        registry,
        showSearch: false,
      },
    })

    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-material-row-key]')).toHaveLength(1)
  })

  it('lets an embedding shell replace presentation without taking over material commands', async () => {
    const wrapper = mount(DesignerPalette, {
      props: {
        materials: registry.listMaterials(),
        registry,
        showSearch: false,
      },
      slots: {
        content: ({ getMaterialBindings, groups, materialTitle }) => h(
          'div',
          { 'data-custom-palette': '' },
          groups.flatMap(([category, materials]) => [
            h('h2', category),
            ...materials.map(material => h(
              'button',
              { ...getMaterialBindings(material), 'data-material-row-key': material.key, 'type': 'button' },
              materialTitle(material),
            )),
          ]),
        ),
      },
    })

    const command = wrapper.get('[data-custom-palette] [data-material-key="test.input"]')
    expect(command.attributes()).toMatchObject({
      'aria-label': 'A very long customer account identifier field',
      'aria-pressed': 'false',
      'data-designer-draggable': 'true',
      'data-material-kind': 'field',
      'data-material-row-key': 'test.input',
    })
    await command.trigger('click')
    await command.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('addMaterial')).toEqual([
      ['test.input'],
      ['test.input'],
    ])
  })

  it('cancels an active pointer material drag with Escape and swallows the release click', async () => {
    const onAddMaterial = vi.fn()
    const dragController = createDesignerDragController({
      commitMaterial: vi.fn(),
      commitNode: vi.fn(),
    })
    const cancel = vi.spyOn(dragController, 'cancel')
    const [material] = registry.listMaterials()
    const Harness = defineComponent({
      setup() {
        const drag = useDesignerPaletteDrag({
          dragController,
          materialTitle: () => material!.title,
          onAddMaterial,
          readonly: () => false,
        })
        return () => h('button', drag.getMaterialBindings(material!))
      },
    })
    const wrapper = mount(Harness, { attachTo: document.body })
    const command = wrapper.get('button')

    command.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 31 }))
    cancel.mockClear()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cancel).toHaveBeenCalledTimes(1)

    // The listener leaves with the session, so a second Escape is a no-op.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cancel).toHaveBeenCalledTimes(1)

    // Releasing the pointer right after Escape must not add the material.
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31 }))
    await command.trigger('click')
    expect(onAddMaterial).not.toHaveBeenCalled()

    await new Promise(resolve => setTimeout(resolve, 0))
    await command.trigger('click')
    expect(onAddMaterial).toHaveBeenCalledWith('test.input')
    wrapper.unmount()
  })
})

describe('palette keyboard drag startup feedback', () => {
  const wrappers: Array<ReturnType<typeof mount>> = []

  function setup() {
    vi.useFakeTimers()
    const commitMaterial = vi.fn()
    const drag = createDesignerDragController({ commitMaterial, commitNode: vi.fn() })
    const begin = vi.spyOn(drag, 'beginMaterialKeyboard')
    const wrapper = mount(DesignerPalette, {
      attachTo: document.body,
      props: { materials: registry.listMaterials(), registry },
      global: { provide: { [DESIGNER_SESSION_KEY as symbol]: { drag } } },
    })
    wrappers.push(wrapper)
    const button = wrapper.get<HTMLButtonElement>('[data-material-key="test.input"]')
    button.element.focus()
    return { begin, button, commitMaterial, drag, wrapper }
  }

  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('announces one visible timeout without inserting or moving focus and allows a successful retry', async () => {
    const { begin, button, commitMaterial, drag, wrapper } = setup()
    await button.trigger('keydown', { key: ' ' })
    await vi.runAllTimersAsync()
    expect(begin).toHaveBeenCalledTimes(31)
    expect(new Set(begin.mock.calls.map(([, id]) => id)).size).toBe(1)
    expect(wrapper.get('[role="status"]').text()).toContain('no available position')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(commitMaterial).not.toHaveBeenCalled()
    expect(wrapper.emitted('addMaterial')).toBeUndefined()
    expect(document.activeElement).toBe(button.element)

    drag.registerKeyboardTargets(() => [{ parentId: null, index: 0 }])
    await button.trigger('keydown', { key: ' ' })
    await vi.runAllTimersAsync()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(commitMaterial).not.toHaveBeenCalled()
    expect(begin).toHaveBeenCalledTimes(32)
    await button.trigger('keydown', { key: ' ' })
    expect(commitMaterial).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(button.element)
  })

  it('succeeds when target registration arrives during retries and stops all later retries', async () => {
    const { begin, button, drag, wrapper } = setup()
    await button.trigger('keydown', { key: ' ' })
    await vi.advanceTimersByTimeAsync(32)
    expect(begin.mock.calls.length).toBeGreaterThan(1)
    drag.registerKeyboardTargets(() => [{ parentId: null, index: 0 }])
    await vi.runAllTimersAsync()
    const count = begin.mock.calls.length
    expect(new Set(begin.mock.calls.map(([, id]) => id)).size).toBe(1)
    expect(drag.session.value?.input).toBe('keyboard')
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await button.trigger('keydown', { key: 'Escape' })
    await vi.runAllTimersAsync()
    expect(begin).toHaveBeenCalledTimes(count)
    expect(drag.session.value).toBeUndefined()
  })

  it.each(['escape', 'enter', 'pointer', 'readonly', 'unmount'] as const)(
    'stops pending retries on %s without a later timeout or accidental insert',
    async (action) => {
      const { begin, button, commitMaterial, wrapper } = setup()
      await button.trigger('keydown', { key: ' ' })
      await vi.advanceTimersByTimeAsync(32)
      const count = begin.mock.calls.length
      if (action === 'escape')
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      else if (action === 'enter')
        await button.trigger('keydown', { key: 'Enter' })
      else if (action === 'pointer')
        button.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 15 }))
      else if (action === 'readonly')
        await wrapper.setProps({ readonly: true })
      else
        wrapper.unmount()
      await vi.runAllTimersAsync()
      expect(begin).toHaveBeenCalledTimes(count)
      expect(commitMaterial).not.toHaveBeenCalled()
      expect(wrapper.emitted('addMaterial')).toEqual(action === 'enter' ? [['test.input']] : undefined)
      if (action !== 'unmount')
        expect(wrapper.get('[role="status"]').text()).toBe('')
    },
  )

  it('cancels startup before nextTick and clears obsolete failure when readonly changes', async () => {
    const { begin, button, wrapper } = setup()
    button.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await vi.runAllTimersAsync()
    expect(begin).not.toHaveBeenCalled()
    await button.trigger('keydown', { key: ' ' })
    await vi.runAllTimersAsync()
    expect(wrapper.get('[role="status"]').text()).not.toBe('')
    await wrapper.setProps({ readonly: true })
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })
})
