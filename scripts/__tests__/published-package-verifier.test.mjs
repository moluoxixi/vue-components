import { describe, expect, it } from 'vitest'
import {
  browserJavaScriptEntrypointAllowlist,
  browserJavaScriptEntrypointExclusions,
  createBrowserBuildArgs,
  createBrowserSmokeSource,
  createNodeSmokeSource,
  createPackedConsumerManifest,
  createTypeSmokeSource,
  getBrowserConsumerSpecifiers,
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
      './RichTextEditor',
      './configForm',
      './element',
      './antd',
    ])
    expect(browserJavaScriptEntrypointExclusions['@moluoxixi/vitepress-theme-element-plus'])
      .toEqual(['.', './markdown'])
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
})
