import type { App, Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { withInstall } from '../src/utils/install'

function createAppStub(): App {
  return {
    component: vi.fn(),
  } as unknown as App
}

describe('withInstall', () => {
  it('registers named components through Vue app.component', () => {
    const component = defineComponent({
      name: 'NamedWidget',
      setup: () => () => null,
    })
    const app = createAppStub()

    withInstall(component).install!(app)

    expect(app.component).toHaveBeenCalledWith('NamedWidget', component)
  })

  it('throws a clear install error when component name is missing', () => {
    const component = {} as Component
    const app = createAppStub()

    expect(() => withInstall(component).install!(app)).toThrow(
      '[ConfigFormCore] Component name is required before install.',
    )
  })
})
