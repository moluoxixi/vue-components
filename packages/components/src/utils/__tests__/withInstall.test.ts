import type { App, Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { withInstall } from '../withInstall'

function createAppStub(): App {
  return { component: vi.fn() } as unknown as App
}

describe('withInstall', () => {
  it('registers a named components package component', () => {
    const component = defineComponent({ name: 'LocalComponent' })
    const app = createAppStub()

    withInstall(component).install!(app)

    expect(app.component).toHaveBeenCalledWith('LocalComponent', component)
  })

  it('rejects unnamed components', () => {
    const component = {} as Component

    expect(() => withInstall(component).install!(createAppStub())).toThrow(
      '[MoluoxixiComponents] Component name is required before install.',
    )
  })
})
