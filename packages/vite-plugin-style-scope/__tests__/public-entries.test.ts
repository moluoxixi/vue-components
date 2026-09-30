import postcss from 'postcss'
import styleScope, { styleScope as namedStyleScope } from 'vite-plugin-style-scope'
import { createStyleScope } from 'vite-plugin-style-scope/runtime'
import { describe, expect, it } from 'vitest'

describe('published entry compatibility', () => {
  it('keeps named/default plugin exports and the independent runtime subpath', () => {
    expect(styleScope).toBe(namedStyleScope)
    expect(styleScope({ appName: 'orders' }).name).toBe('vite-plugin-style-scope')
    expect(createStyleScope).toBeTypeOf('function')
    expect(typeof document).toBe('undefined')
  })

  it('retains scoped selectors, root variables, and animation keyframes', async () => {
    const plugin = styleScope({ appName: 'orders' })
    const config = await (plugin.config as () => { css: { postcss: { plugins: postcss.AcceptedPlugin[] } } })()
    const result = await postcss(config.css.postcss.plugins).process(
      ':root { --accent: red } .card { color: red } @keyframes pulse { from { opacity: 0 } to { opacity: 1 } }',
      { from: '/src/app.css' },
    )
    expect(result.css).toContain('[data-qiankun="orders"] { --accent: red }')
    expect(result.css).toContain(':where([data-qiankun="orders"]) .card')
    expect(result.css).toContain('from { opacity: 0 }')
    expect(result.css).not.toContain(']) from')
  })

  it('emits the runtime import through the preserved public subpath', async () => {
    const plugin = styleScope({ appName: 'orders' })
    const resolved = await (plugin.resolveId as (id: string) => string)('virtual:style-scope')
    const source = await (plugin.load as (id: string) => string)(resolved)
    expect(source).toContain('from \'vite-plugin-style-scope/runtime\'')
    expect(source).toContain('export const SCOPE_VALUE = "orders"')
  })
})
