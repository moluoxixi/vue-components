// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { createDesignerDragVisualClone } from '../src/components/DesignerCanvas/utils'

describe('designer drag visual clone', () => {
  it('removes editor metadata, form identity, links, and live handlers', () => {
    const source = document.createElement('section')
    source.id = 'live-node'
    source.dataset.configNodeId = 'field-1'
    source.dataset.designerDraggable = ''
    source.innerHTML = '<label for="email"><input id="email" name="email" tabindex="0"><a href="/account">Account</a></label>'
    const click = vi.fn()
    source.addEventListener('click', click)

    const clone = createDesignerDragVisualClone(source)
    clone.click()

    expect(clone.id).toBe('')
    expect(clone.hasAttribute('data-config-node-id')).toBe(false)
    expect(clone.hasAttribute('data-designer-draggable')).toBe(false)
    expect(clone.querySelector('label')?.hasAttribute('for')).toBe(false)
    expect(clone.querySelector('input')?.hasAttribute('name')).toBe(false)
    expect(clone.querySelector('input')?.getAttribute('tabindex')).toBe('-1')
    expect(clone.querySelector('a')?.hasAttribute('href')).toBe(false)
    expect(click).not.toHaveBeenCalled()
  })
})
