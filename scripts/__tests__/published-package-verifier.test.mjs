import { describe, expect, it } from 'vitest'
import {
  browserJavaScriptEntrypointAllowlist,
  browserJavaScriptEntrypointExclusions,
  createBrowserBuildArgs,
  createBrowserConsumerBatches,
  createBrowserReplContractStubSource,
  createBrowserSmokeSource,
  createBrowserViteConfigSource,
  createNodeSmokeSource,
  createPackedConsumerManifest,
  createTypeSmokeSource,
  getBrowserBundleForbiddenFragments,
  getBrowserConsumerSpecifiers,
  getNodeRuntimeSpecifiers,
  getPublicSpecifier,
  getStylesheetEntrypoints,
  getTypedJavaScriptEntrypoints,
} from '../published-package-verifier.mjs'

describe('published package verifier helpers', () => {
  it('maps root and subpath exports to public specifiers', () => {
    expect(getPublicSpecifier('@scope/example', '.')).toBe('@scope/example')
    expect(getPublicSpecifier('@scope/example', './feature')).toBe('@scope/example/feature')
  })

  it('discovers typed JavaScript exports only', () => {
    expect(getTypedJavaScriptEntrypoints({
      exports: {
        '.': { import: './dist/index.js', types: './dist/index.d.ts' },
        './missing-import': { types: './dist/missing.d.ts' },
        './missing-types': { import: './dist/missing.js' },
        './styles': { import: './dist/styles.css', types: './dist/styles.d.ts' },
      },
    })).toEqual(['.'])
    expect(getTypedJavaScriptEntrypoints({})).toEqual([])
    expect(getTypedJavaScriptEntrypoints({ exports: './dist/index.js' })).toEqual([])
  })

  it('discovers object and string stylesheet exports without wildcard imports', () => {
    expect(getStylesheetEntrypoints({
      exports: {
        './repl.css': './src/repl/styles.css',
        './styles': { import: './dist/styles.css' },
        './themes/*': './dist/themes/*.css',
        './feature': { import: './dist/feature.js' },
      },
    })).toEqual(['./repl.css', './styles'])
    expect(getStylesheetEntrypoints({ exports: null })).toEqual([])
  })

  it('selects explicit browser-capable JavaScript and stylesheet entries', () => {
    const manifests = [
      {
        name: '@scope/components',
        exports: {
          '.': { import: './dist/index.js', types: './dist/index.d.ts' },
          './Table': { import: './dist/Table.js', types: './dist/Table.d.ts' },
          './styles': { import: './dist/styles.css' },
        },
      },
    ]

    expect(getBrowserConsumerSpecifiers(
      manifests,
      { '@scope/components': ['.', './Table'] },
      { '@scope/components': ['./styles'] },
    )).toEqual({
      javaScript: ['@scope/components', '@scope/components/Table'],
      stylesheets: ['@scope/components/styles'],
    })
  })

  it('keeps component browser entries explicit', () => {
    expect(browserJavaScriptEntrypointAllowlist['@moluoxixi/ai-provider'])
      .toEqual(['.', './shared'])
    expect(browserJavaScriptEntrypointExclusions['@moluoxixi/ai-provider'])
      .toEqual(['./server'])
    expect(browserJavaScriptEntrypointAllowlist['@moluoxixi/i18n-tool'])
      .toEqual(['./protocol'])
    expect(browserJavaScriptEntrypointExclusions['@moluoxixi/i18n-tool'])
      .toEqual(['.', './config', './core', './server'])
    expect(browserJavaScriptEntrypointAllowlist['@moluoxixi/components']).toEqual([
      '.',
      './auto-loaders',
      './playground-manifest',
      './AntdConfigForm',
      './ConfigTable',
      './CopyText',
      './DateRangePicker',
      './ElementConfigForm',
      './EnterNextContainer',
      './HeadlessCopyText',
      './HeadlessTable',
      './PopoverTableSelect',
      './RequestCascader',
      './RequestSelectV2',
      './RequestTreeSelect',
      './configForm',
      './element',
      './antd',
    ])
    expect(browserJavaScriptEntrypointExclusions['@moluoxixi/vitepress-theme-element-plus'])
      .toEqual(['.', './markdown', './node', './repository/node'])
    expect(getNodeRuntimeSpecifiers([
      {
        name: '@moluoxixi/ai-provider',
        exports: {
          './server': {
            import: './dist/server.js',
            types: './dist/server.d.ts',
          },
        },
      },
      {
        name: '@moluoxixi/i18n-tool',
        exports: {
          './config': { import: './dist/config.js', types: './dist/config.d.ts' },
          './core': { import: './dist/core.js', types: './dist/core.d.ts' },
          './server': { import: './dist/server.js', types: './dist/server.d.ts' },
        },
      },
      {
        name: '@moluoxixi/vitepress-theme-element-plus',
        exports: {
          './node': {
            import: './dist/node.js',
            types: './dist/node.d.ts',
          },
          './repository/node': {
            import: './dist/repository-node.js',
            types: './dist/src/node/repository/index.d.ts',
          },
        },
      },
    ])).toEqual([
      '@moluoxixi/ai-provider/server',
      '@moluoxixi/i18n-tool/config',
      '@moluoxixi/i18n-tool/core',
      '@moluoxixi/i18n-tool/server',
      '@moluoxixi/vitepress-theme-element-plus/node',
      '@moluoxixi/vitepress-theme-element-plus/repository/node',
    ])
  })

  it('fails when the browser allowlist drifts from public exports', () => {
    expect(() => getBrowserConsumerSpecifiers(
      [{ name: '@scope/components', exports: {} }],
      { '@scope/components': ['./missing'] },
      {},
    )).toThrow('Browser smoke JavaScript entry @scope/components/missing is not exported.')
  })

  it('fails when a browser package export has not been classified', () => {
    expect(() => getBrowserConsumerSpecifiers(
      [{
        name: '@scope/components',
        exports: {
          '.': { import: './dist/index.js', types: './dist/index.d.ts' },
          './new-entry': { import: './dist/new-entry.js', types: './dist/new-entry.d.ts' },
        },
      }],
      { '@scope/components': ['.'] },
      {},
    )).toThrow('Browser smoke JavaScript entries for @scope/components are not classified: ./new-entry.')
  })

  it('generates Node, type, and browser smoke sources from discovered specifiers', () => {
    const nodeSource = createNodeSmokeSource(['@scope/root'], ['@scope/root/feature'])
    const typeSource = createTypeSmokeSource(['@scope/root', '@scope/root/feature'])
    const browserSource = createBrowserSmokeSource(
      ['@moluoxixi/components/HeadlessTable'],
      ['@moluoxixi/components/styles'],
    )

    expect(nodeSource).toContain(`from "@scope/root"`)
    expect(nodeSource).toContain(`import.meta.resolve("@scope/root/feature")`)
    expect(typeSource).toBe('import "@scope/root";\nimport "@scope/root/feature";')
    expect(browserSource).toContain(`from "@moluoxixi/components/HeadlessTable"`)
    expect(browserSource).toContain(`import "@moluoxixi/components/styles"`)
    expect(browserSource).toContain(`.join('\\n')`)
    expect(browserSource).toContain('__PACKED_BROWSER_SMOKE__')
    expect(browserSource).toContain('copyTextStyles')
    expect(browserSource).toContain('richTextStyles')
    expect(browserSource).toContain('replStyles')
  })

  it('declares the browser bundler in the isolated packed consumer', () => {
    expect(createPackedConsumerManifest({
      browserBundlerVersion: '^6.2.0',
      packageManager: 'pnpm@10.29.3',
      packedDependencies: { '@scope/example': 'file:/tmp/example.tgz' },
    })).toEqual({
      dependencies: { '@scope/example': 'file:/tmp/example.tgz' },
      devDependencies: { vite: '^6.2.0' },
      packageManager: 'pnpm@10.29.3',
      private: true,
      type: 'module',
    })
    expect(createBrowserBuildArgs('/tmp/consumer', '/tmp/consumer/browser')).toEqual([
      '--dir',
      '/tmp/consumer',
      'exec',
      'vite',
      'build',
      '/tmp/consumer/browser',
    ])
  })

  it('batches browser entries without losing order or stylesheet coverage', () => {
    const javaScript = Array.from({ length: 9 }, (_, index) => `@scope/example/${index}`)
    const stylesheets = ['@scope/example/styles', '@scope/theme/styles']
    const batches = createBrowserConsumerBatches({ javaScript, stylesheets }, 4)

    expect(batches.map(batch => batch.javaScript.length)).toEqual([4, 4, 1])
    expect(batches.flatMap(batch => batch.javaScript)).toEqual(javaScript)
    expect(batches.every(batch => (
      batch.stylesheets !== stylesheets
      && batch.stylesheets.join() === stylesheets.join()
    ))).toBe(true)
    expect(createBrowserConsumerBatches({
      javaScript: javaScript.slice(0, 2),
      stylesheets,
    }).map(batch => batch.javaScript.length)).toEqual([2])
  })

  it('isolates heavyweight browser entries without dropping adjacent entries', () => {
    const isolated = '@scope/example/heavy'
    const batches = createBrowserConsumerBatches({
      javaScript: ['a', 'b', isolated, 'c', 'd', 'e'],
      stylesheets: ['styles'],
    }, 4, [isolated])

    expect(batches.map(batch => batch.javaScript)).toEqual([
      ['a', 'b'],
      [isolated],
      ['c', 'd', 'e'],
    ])
    expect(batches.flatMap(batch => batch.javaScript)).toEqual(['a', 'b', isolated, 'c', 'd', 'e'])
  })

  it('supports stylesheet-only batches and rejects invalid batch sizes', () => {
    expect(createBrowserConsumerBatches({
      javaScript: [],
      stylesheets: ['@scope/example/styles'],
    })).toEqual([{
      javaScript: [],
      stylesheets: ['@scope/example/styles'],
    }])
    expect(createBrowserConsumerBatches({ javaScript: [], stylesheets: [] })).toEqual([])
    expect(() => createBrowserConsumerBatches({
      javaScript: ['@scope/example'],
      stylesheets: [],
    }, 0)).toThrow('Browser consumer batch size must be a positive integer.')
  })

  it('uses the official CodeMirror editor only for the packed REPL smoke batch', () => {
    expect(createBrowserViteConfigSource([
      '@moluoxixi/vitepress-theme-element-plus/repl',
    ])).toContain(`find: '@vue/repl/monaco-editor'`)
    expect(createBrowserViteConfigSource([
      '@moluoxixi/vitepress-theme-element-plus/repl',
    ])).toContain(`replacement: '@vue/repl/codemirror-editor'`)
    expect(createBrowserViteConfigSource([
      '@moluoxixi/vitepress-theme-element-plus/repl',
    ])).toContain(`find: /^@vue\\/repl$/`)
    expect(createBrowserReplContractStubSource()).toContain('export const Repl')
    expect(createBrowserReplContractStubSource()).toContain('export function useStore')
    expect(createBrowserViteConfigSource([
      '@moluoxixi/components',
    ])).toBe('export default {"resolve":{"alias":[]}}')
  })

  it('classifies AI provider browser safety and Node runtime entries', () => {
    const manifest = {
      name: '@moluoxixi/ai-provider',
      exports: {
        '.': { import: './dist/index.js', types: './dist/index.d.ts' },
        './server': { import: './dist/server.js', types: './dist/server.d.ts' },
        './shared': { import: './dist/shared.js', types: './dist/shared.d.ts' },
      },
    }

    expect(getBrowserConsumerSpecifiers([manifest], {
      '@moluoxixi/ai-provider': ['.', './shared'],
    }, {})).toEqual({
      javaScript: ['@moluoxixi/ai-provider', '@moluoxixi/ai-provider/shared'],
      stylesheets: [],
    })
    expect(getNodeRuntimeSpecifiers([manifest], {
      '@moluoxixi/ai-provider': ['./server'],
    })).toEqual(['@moluoxixi/ai-provider/server'])
    expect(getBrowserBundleForbiddenFragments([manifest], {
      '@moluoxixi/ai-provider': [
        '/chat/completions',
        '/embeddings',
        'chatApiKey',
        'embeddingApiKey',
      ],
    })).toEqual([
      '/chat/completions',
      '/embeddings',
      'chatApiKey',
      'embeddingApiKey',
    ])
  })

  it('classifies i18n-tool protocol and Node-only entries', () => {
    const manifest = {
      name: '@moluoxixi/i18n-tool',
      exports: {
        '.': { import: './dist/index.js', types: './dist/index.d.ts' },
        './config': { import: './dist/config.js', types: './dist/config.d.ts' },
        './core': { import: './dist/core.js', types: './dist/core.d.ts' },
        './protocol': { import: './dist/protocol.js', types: './dist/protocol.d.ts' },
        './server': { import: './dist/server.js', types: './dist/server.d.ts' },
      },
    }

    expect(getBrowserConsumerSpecifiers([manifest], {
      '@moluoxixi/i18n-tool': ['./protocol'],
    }, {})).toEqual({
      javaScript: ['@moluoxixi/i18n-tool/protocol'],
      stylesheets: [],
    })
    expect(getNodeRuntimeSpecifiers([manifest], {
      '@moluoxixi/i18n-tool': ['./config', './core', './server'],
    })).toEqual([
      '@moluoxixi/i18n-tool/config',
      '@moluoxixi/i18n-tool/core',
      '@moluoxixi/i18n-tool/server',
    ])
  })
})
