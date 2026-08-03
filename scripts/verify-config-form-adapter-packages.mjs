import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const adapters = [
  {
    directory: 'plugin-antd-vue',
    exports: ['ANTD_VUE_FIELD_BINDINGS', 'ANTD_VUE_READONLY_ADAPTERS', 'createAntdVuePlugin'],
    name: '@moluoxixi/config-form-plugin-antd-vue',
    types: ['AntdVueFieldBinding', 'AntdVuePluginOptions'],
  },
  {
    directory: 'plugin-element-plus',
    exports: ['ELEMENT_PLUS_READONLY_ADAPTERS', 'createElementPlusPlugin'],
    name: '@moluoxixi/config-form-plugin-element-plus',
    types: ['ElementPlusPluginOptions'],
  },
  {
    directory: 'plugin-shadcn-vue',
    exports: ['SHADCN_VUE_FIELD_BINDINGS', 'SHADCN_VUE_READONLY_ADAPTERS', 'createShadcnVuePlugin'],
    name: '@moluoxixi/config-form-plugin-shadcn-vue',
    types: ['ShadcnVueFieldBinding', 'ShadcnVuePluginOptions'],
  },
]

function fail(message) {
  throw new Error(`[ConfigForm adapter package] ${message}`)
}

function verifyRendererPackage() {
  const packageDir = resolve(rootDir, 'packages', 'ConfigForm', 'runtime')
  const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
  const rendererExport = manifest.exports?.['./renderer']

  if (!rendererExport?.source || !rendererExport?.import || !rendererExport?.types)
    fail('@moluoxixi/config-form/renderer must expose source, import, and types conditions')

  const bundlePath = resolve(packageDir, rendererExport.import)
  const declarationsPath = resolve(packageDir, rendererExport.types)
  if (!existsSync(bundlePath) || !existsSync(declarationsPath))
    fail('@moluoxixi/config-form/renderer build output or declarations are missing')

  const importCheck = `
    const loaded = await import('@moluoxixi/config-form/renderer')
    const expected = ['ConfigFormRenderer', 'createConfigFormRendererExpose', 'withConfigFormInstall'].sort()
    const actual = Object.keys(loaded).sort()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Unexpected renderer exports: ' + actual.join(','))
    }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', importCheck], {
    cwd: packageDir,
    encoding: 'utf8',
  })
  if (result.status !== 0)
    fail(`@moluoxixi/config-form/renderer package self-reference failed: ${result.stderr || result.stdout}`)

  const consumerDir = mkdtempSync(resolve(packageDir, '.config-form-renderer-smoke-'))
  try {
    writeFileSync(resolve(consumerDir, 'consumer.ts'), `
      import {
        ConfigFormRenderer,
        createConfigFormRendererExpose,
        withConfigFormInstall,
      } from '@moluoxixi/config-form/renderer'
      import type {
        ConfigFormRendererComponent,
        ConfigFormRendererComponentInstance,
        ConfigFormRendererComponentProps,
        ConfigFormRendererExpose,
        ConfigFormRendererProps,
        InstallableConfigFormComponent,
      } from '@moluoxixi/config-form/renderer'

      void [ConfigFormRenderer, createConfigFormRendererExpose, withConfigFormInstall]
      const typedRenderer: ConfigFormRendererComponent = ConfigFormRenderer
      void typedRenderer
      type RendererTypes = [
        ConfigFormRendererComponentInstance,
        ConfigFormRendererComponentProps,
        ConfigFormRendererExpose,
        ConfigFormRendererProps,
        InstallableConfigFormComponent<never>,
      ]
      const rendererTypes: RendererTypes | undefined = undefined
      void rendererTypes
    `)
    const compilerOptions = {
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: 'ES2022',
    }
    const declarationsConfigPath = resolve(consumerDir, 'tsconfig.declarations.json')
    const sourceConfigPath = resolve(consumerDir, 'tsconfig.source.json')
    writeFileSync(declarationsConfigPath, JSON.stringify({
      compilerOptions,
      files: ['./consumer.ts'],
    }, null, 2))
    writeFileSync(sourceConfigPath, JSON.stringify({
      compilerOptions: {
        ...compilerOptions,
        customConditions: ['source'],
        types: ['vite/client'],
      },
      files: ['./consumer.ts'],
    }, null, 2))

    const tscPath = resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc')
    const declarationsResult = spawnSync(process.execPath, [tscPath, '--project', declarationsConfigPath], {
      cwd: consumerDir,
      encoding: 'utf8',
    })
    if (declarationsResult.status !== 0) {
      fail(`@moluoxixi/config-form/renderer declaration consumer failed: ${declarationsResult.stderr || declarationsResult.stdout}`)
    }

    const vueTscPath = resolve(packageDir, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js')
    const sourceResult = spawnSync(process.execPath, [vueTscPath, '--project', sourceConfigPath], {
      cwd: consumerDir,
      encoding: 'utf8',
    })
    if (sourceResult.status !== 0)
      fail(`@moluoxixi/config-form/renderer source consumer failed: ${sourceResult.stderr || sourceResult.stdout}`)
  }
  finally {
    rmSync(consumerDir, { force: true, recursive: true })
  }
}

verifyRendererPackage()

for (const adapter of adapters) {
  const packageDir = resolve(rootDir, 'packages', 'ConfigForm', adapter.directory)
  const manifestPath = resolve(packageDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const rootExport = manifest.exports?.['.']

  if (manifest.peerDependencies?.vue !== '^3.5.0')
    fail(`${adapter.name} must declare vue ^3.5.0 as a peer dependency`)
  if (!rootExport?.import || !rootExport?.types)
    fail(`${adapter.name} must expose import and types conditions at the package root`)

  const bundlePath = resolve(packageDir, rootExport.import)
  const declarationsPath = resolve(packageDir, rootExport.types)
  if (!existsSync(bundlePath) || !existsSync(declarationsPath))
    fail(`${adapter.name} build output or declarations are missing`)

  const bundle = readFileSync(bundlePath, 'utf8')
  if (bundle.includes('@vue/shared'))
    fail(`${adapter.name} inlines @vue/shared`)
  if (!/\bfrom\s+['"]vue['"]/.test(bundle))
    fail(`${adapter.name} does not preserve Vue as an external import`)

  const importCheck = `
    const loaded = await import(${JSON.stringify(adapter.name)})
    const expected = ${JSON.stringify(adapter.exports)}.sort()
    const actual = Object.keys(loaded).sort()
    if ('default' in loaded || JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Unexpected exports: ' + actual.join(','))
    }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', importCheck], {
    cwd: packageDir,
    encoding: 'utf8',
  })
  if (result.status !== 0)
    fail(`${adapter.name} package self-reference failed: ${result.stderr || result.stdout}`)

  const consumerDir = mkdtempSync(resolve(packageDir, '.config-form-package-smoke-'))
  try {
    const consumerPath = resolve(consumerDir, 'consumer.ts')
    const tsconfigPath = resolve(consumerDir, 'tsconfig.json')
    writeFileSync(consumerPath, `
      import { ${adapter.exports.join(', ')} } from ${JSON.stringify(adapter.name)}
      import type { ${adapter.types.join(', ')} } from ${JSON.stringify(adapter.name)}

      void [${adapter.exports.join(', ')}]
      type PublicTypes = [${adapter.types.join(', ')}]
      const publicTypes: PublicTypes | undefined = undefined
      void publicTypes
    `)
    writeFileSync(tsconfigPath, JSON.stringify({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: 'ES2022',
      },
      files: ['./consumer.ts'],
    }, null, 2))

    const tscPath = resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc')
    const typeResult = spawnSync(process.execPath, [tscPath, '--project', tsconfigPath], {
      cwd: consumerDir,
      encoding: 'utf8',
    })
    if (typeResult.status !== 0)
      fail(`${adapter.name} TypeScript consumer failed: ${typeResult.stderr || typeResult.stdout}`)
  }
  finally {
    rmSync(consumerDir, { force: true, recursive: true })
  }
}

console.log('PASS ConfigForm runtime adapter package boundaries')
