// @vitest-environment happy-dom

import type { ProjectDialogSurface, ProjectDrawerSurface } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { createProjectDocumentFixture } from '../../../project/__tests__/fixtures'
import { createPagePreviewDataUrl } from '../services'

function previewSvg(surface: Parameters<typeof createPagePreviewDataUrl>[0]): Document {
  const source = decodeURIComponent(createPagePreviewDataUrl(surface).split(',')[1]!)
  return new DOMParser().parseFromString(source, 'image/svg+xml')
}

describe('page preview', () => {
  it('shows real field labels, selected option labels, and the active switch', () => {
    const document = createProjectDocumentFixture()
    const surface = document.surfacesById.home!
    const svg = previewSvg(surface)

    expect(svg.querySelector('parsererror')).toBeNull()
    expect(svg.documentElement.textContent).toContain('Name')
    expect(svg.documentElement.textContent).toContain('Role')
    expect(svg.documentElement.textContent).toContain('Developer')
    expect(svg.documentElement.textContent).toContain('Enter your name')
    expect(svg.querySelector('rect[width="38"]')?.getAttribute('fill')).toBe('#409eff')
  })

  it('escapes imported names and labels as text and keeps long labels within their controls', () => {
    const surface = structuredClone(createProjectDocumentFixture().surfacesById.home!)
    surface.name = '<script>alert("name")</script>'
    const field = Object.values(surface.graph.nodesById).find(node => node.kind === 'field')!
    if (field.kind !== 'field')
      throw new Error('Fixture needs a field')
    field.label = '<image href="https://example.com" />&'.repeat(5)
    const svg = previewSvg(surface)

    expect(svg.querySelector('parsererror')).toBeNull()
    expect(svg.querySelector('script, image')).toBeNull()
    expect(svg.querySelector('title')?.textContent).toBe(surface.name)
    expect([...svg.querySelectorAll('text')].some(text => text.textContent?.includes('\u2026'))).toBe(true)
  })

  it('distinguishes a dialog from a drawer and honors the drawer placement', () => {
    const page = createProjectDocumentFixture().surfacesById.home!
    const dialog: ProjectDialogSurface = {
      ...page,
      kind: 'dialog',
      presentation: { kind: 'dialog', title: 'Edit profile', width: { desktop: { value: 520, unit: 'px' } }, mask: true, close: { button: true, escape: true, mask: true } },
    }
    const drawer: ProjectDrawerSurface = {
      ...page,
      kind: 'drawer',
      presentation: { kind: 'drawer', title: 'Profile details', placement: 'left', size: { desktop: { value: 480, unit: 'px' } }, mask: true, close: { button: true, escape: true, mask: true } },
    }

    expect(previewSvg(dialog).querySelector('rect[fill="#fff"]')?.getAttribute('x')).toBe('100')
    expect(previewSvg(drawer).querySelector('rect[fill="#fff"]')?.getAttribute('x')).toBe('0')
    drawer.presentation.placement = 'right'
    expect(previewSvg(drawer).querySelector('rect[fill="#fff"]')?.getAttribute('x')).toBe('224')
    expect(previewSvg(drawer).querySelector('title')?.textContent).toBe('Profile details')
  })
})
