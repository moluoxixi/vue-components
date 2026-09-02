import type { App, Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { withConfigFormInstall } from '../services'

function createAppStub(): App {
  return { component: vi.fn() } as unknown as App
}

describe('withConfigFormInstall', () => {
  it('registers a named renderer adapter', () => {
    const component = defineComponent({ name: 'ConfigFormAdapter' })
    const app = createAppStub()

    withConfigFormInstall(component).install!(app)

    expect(app.component).toHaveBeenCalledWith('ConfigFormAdapter', component)
  })

  it('rejects unnamed renderer adapters', () => {
    const component = {} as Component

    expect(() => withConfigFormInstall(component).install!(createAppStub())).toThrow(
      '[ConfigFormRenderer] Component name is required before install.',
    )
  })
})
