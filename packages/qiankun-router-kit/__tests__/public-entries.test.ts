import { resolveRouterConfig, stripBase } from 'qiankun-router-kit'
import * as core from 'qiankun-router-kit/main/core'
import * as react from 'qiankun-router-kit/main/react'
import * as vue2 from 'qiankun-router-kit/main/vue2'
import * as vue3 from 'qiankun-router-kit/main/vue3'
import * as sub from 'qiankun-router-kit/sub/core'
import * as subVue3 from 'qiankun-router-kit/sub/vue3'
import { describe, expect, it, vi } from 'vitest'

vi.mock('qiankun', () => ({ loadMicroApp: vi.fn() }))
vi.mock('vite-plugin-qiankun/dist/helper', () => ({
  qiankunWindow: {},
  renderWithQiankun: vi.fn(),
}))

const app = { name: 'orders', entry: '/orders.html', activeRule: '/tenant/:id/orders' }

describe('public entry compatibility', () => {
  it('exposes framework-independent configuration at the root and sub entry', () => {
    expect(resolveRouterConfig).toBe(sub.resolveRouterConfig)
    expect(resolveRouterConfig()).toEqual({ base: '/', mode: 'history' })
    expect(resolveRouterConfig({
      isQiankun: true,
      props: { routerMode: 'memory', routerBase: '/ignored' },
    })).toEqual({ base: '/', mode: 'memory' })
    expect(stripBase('/orders/details', '/orders')).toBe('/details')
    expect(stripBase('/orders-archive', '/orders')).toBeNull()
  })

  it('re-exports one main controller and manifest implementation from each framework', () => {
    for (const entry of [react, vue2, vue3]) {
      expect(entry.createMicroAppController).toBe(core.createMicroAppController)
      expect(entry.normalizeMicroApps).toBe(core.normalizeMicroApps)
      expect(entry.MicroApp).toBeDefined()
    }
    expect(core.normalizeMicroApps([app])).toEqual([{ app, prefixes: ['/tenant/:id/orders'] }])
    expect(core.resolvePrefix('/tenant/:id/orders', { id: 'a' })).toBe('/tenant/a/orders')
  })

  it('preserves Vue route shapes and parameter mapping across both public adapters', () => {
    const component = {}
    const vue2Route = vue2.createMicroAppRoutes([app], component)[0]!
    const vue3Route = vue3.createMicroAppRoutes([app], component)[0]!
    expect(vue2Route.path).toBe('/tenant/:id/orders/:pathMatch*')
    expect(vue3Route.path).toBe('/tenant/:id/orders/:pathMatch(.*)*')
    for (const route of [vue2Route, vue3Route]) {
      expect(route.meta?.microApp).toBe(app)
      expect(route.component).toBe(component)
      expect((route.props as (input: { params: { id: string } }) => { app: typeof app & { props: { routerBase: string } } })({ params: { id: 'a' } }).app.props.routerBase)
        .toBe('/tenant/a/orders')
    }
    expect(app).not.toHaveProperty('props')
  })

  it('keeps the React splat route and public convenience entry available', () => {
    const [route] = react.createMicroAppRoutes([app], () => null)
    expect(route?.path).toBe('/tenant/:id/orders/*')
    expect(route?.handle.microApp).toBe(app)
    expect(route?.element).toBeDefined()
    expect(react.createMainRoutes({ apps: [app] })).toHaveLength(1)
  })

  it('retains the public Vue sub-application lifecycle and router functions', () => {
    expect(subVue3.resolveRouterConfig).toBe(sub.resolveRouterConfig)
    expect(subVue3.createSubRouter).toBeTypeOf('function')
    expect(subVue3.destroySubRouter).toBeTypeOf('function')
    expect(subVue3.defineSubApp).toBeTypeOf('function')
  })
})
