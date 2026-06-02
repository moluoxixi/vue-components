import { describe, expect, it } from 'vitest'
import {
  configFormDevtools,
  ConfigFormDevtoolsHttpError,
  ConfigFormDevtoolsPluginError,
  configFormDevtoolsVitePlugin,
} from '../index'

describe('configFormDevtools vite plugin', () => {
  it('is a development-only pre transform plugin', () => {
    const plugin = configFormDevtools()

    expect(plugin.name).toBe('moluoxixi:config-form-devtools')
    expect(plugin.apply).toBe('serve')
    expect(plugin.enforce).toBe('pre')
  })

  it('exports the explicit vite plugin alias', () => {
    expect(configFormDevtoolsVitePlugin).toBe(configFormDevtools)
  })

  it('exports the public error classes', () => {
    expect(ConfigFormDevtoolsPluginError).toBeTypeOf('function')
    expect(ConfigFormDevtoolsHttpError).toBeTypeOf('function')
  })

  it('transforms supported source files through the plugin hook', () => {
    const plugin = configFormDevtools()
    const transform = plugin.transform

    if (typeof transform !== 'function')
      throw new Error('Expected transform hook to be a function')

    const result = transform.call(
      {} as never,
      [
        'import { defineField } from \'@moluoxixi/config-form\'',
        'const item = defineField({ field: \'name\', component: \'input\' })',
      ].join('\n'),
      'D:/project-new/ConfigForm/playgrounds/demo.ts',
    )

    expect(result).toMatchObject({
      code: expect.stringContaining('__source'),
    })
    expect(result).toMatchObject({
      code: expect.stringContaining('virtual:config-form-devtools/config-form'),
    })
  })

  it('rewrites ConfigForm imports even when a file has no defineField calls', () => {
    const plugin = configFormDevtools()
    const transform = plugin.transform

    if (typeof transform !== 'function')
      throw new Error('Expected transform hook to be a function')

    const result = transform.call(
      {} as never,
      'import { ConfigForm } from \'@moluoxixi/config-form\'\nexport const view = ConfigForm',
      'D:/project-new/ConfigForm/playgrounds/demo.ts',
    )

    expect(result).toMatchObject({
      code: expect.stringContaining('virtual:config-form-devtools/config-form'),
    })
  })

  it('skips node_modules and unsupported files in the transform hook', () => {
    const plugin = configFormDevtools()
    const transform = plugin.transform

    if (typeof transform !== 'function')
      throw new Error('Expected transform hook to be a function')

    expect(transform.call(
      {} as never,
      'import { defineField } from \'@moluoxixi/config-form\'\ndefineField({})',
      'D:/project-new/ConfigForm/node_modules/pkg/index.ts',
    )).toBeNull()

    expect(transform.call(
      {} as never,
      'import { defineField } from \'@moluoxixi/config-form\'\ndefineField({})',
      'D:/project-new/ConfigForm/README.md',
    )).toBeNull()

    expect(transform.call(
      {} as never,
      '.demo { color: red; }',
      'D:/project-new/ConfigForm/playgrounds/src/App.vue?vue&type=style&index=0&lang.scss',
    )).toBeNull()
  })

  it('registers the open-in-editor middleware', () => {
    const plugin = configFormDevtools({ editor: 'cursor' })
    const configureServer = plugin.configureServer
    const handlers: Array<{ path: string, handler: unknown }> = []

    if (typeof configureServer !== 'function')
      throw new Error('Expected configureServer hook to be a function')

    configureServer({
      config: { root: 'D:/project-new/ConfigForm' },
      middlewares: {
        use(path: string, handler: unknown) {
          handlers.push({ handler, path })
        },
      },
    } as never)

    expect(handlers).toHaveLength(1)
    expect(handlers[0]?.path).toBe('/__config-form-devtools/open')
    expect(typeof handlers[0]?.handler).toBe('function')
  })

  it('injects the client module into html', () => {
    const plugin = configFormDevtools()
    const transformIndexHtml = plugin.transformIndexHtml

    if (typeof transformIndexHtml !== 'function')
      throw new Error('Expected transformIndexHtml hook to be a function')

    const tags = transformIndexHtml.call({} as never, '<html><head></head><body></body></html>', {} as never)

    expect(tags).toEqual([
      expect.objectContaining({
        children: 'window.__CONFIG_FORM_DEVTOOLS_PENDING__ = true;',
        tag: 'script',
      }),
      expect.objectContaining({
        attrs: {
          src: '/@id/__x00__virtual:config-form-devtools/client',
          type: 'module',
        },
        tag: 'script',
      }),
    ])
  })

  it('resolves and loads the virtual client module', () => {
    const plugin = configFormDevtools()
    const resolveId = plugin.resolveId
    const load = plugin.load

    if (typeof resolveId !== 'function' || typeof load !== 'function')
      throw new Error('Expected resolveId and load hooks to be functions')

    const resolved = resolveId.call({} as never, 'virtual:config-form-devtools/client', undefined, {} as never)
    expect(resolved).toBe('\0virtual:config-form-devtools/client')
    expect(resolveId.call({} as never, 'virtual:other', undefined, {} as never)).toBeNull()

    expect(String(load.call({} as never, resolved as string))).toContain('installConfigFormDevtools')
    expect(load.call({} as never, '\0virtual:other')).toBeNull()
  })

  it('resolves and loads the virtual ConfigForm devtools adapter module', () => {
    const plugin = configFormDevtools()
    const resolveId = plugin.resolveId
    const load = plugin.load

    if (typeof resolveId !== 'function' || typeof load !== 'function')
      throw new Error('Expected resolveId and load hooks to be functions')

    const resolved = resolveId.call({} as never, 'virtual:config-form-devtools/config-form', undefined, {} as never)
    expect(resolved).toBe('\0virtual:config-form-devtools/config-form')

    const code = String(load.call({} as never, resolved as string))
    expect(code).toContain('createDevtoolsConfigFormAdapter')
    expect(code).toContain('@moluoxixi/config-form')
  })
})
