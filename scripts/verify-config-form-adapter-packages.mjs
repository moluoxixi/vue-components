import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const publicContractPackages = [
  {
    directory: 'core',
    exports: [
      'ConfigFormModuleRegistryError',
      'createConfigFormModuleRegistry',
      'defineConfigFormModule',
    ],
    name: '@moluoxixi/config-form-core',
    types: [
      'ConfigFormNamedModule',
      'ConfigFormNamedModuleMap',
      'ConfigFormNamedModuleRegistry',
      'ConfigFormNamedRegistryEntry',
    ],
    typeUsages: [
      'ConfigFormNamedModule<unknown>',
      'ConfigFormNamedModuleMap<unknown>',
      'ConfigFormNamedModuleRegistry<unknown>',
      'ConfigFormNamedRegistryEntry<unknown>',
    ],
  },
  {
    directory: 'model',
    exports: [
      'PAGE_GRAPH_VERSION',
      'PROJECT_DOCUMENT_VERSION',
      'assertProjectDocument',
      'parseProjectDocument',
    ],
    name: '@moluoxixi/config-form-model',
    types: [
      'ComponentContract',
      'PageGraph',
      'ProjectCommand',
      'ProjectDocument',
      'ProjectSnapshot',
      'ProjectTransaction',
    ],
  },
  {
    directory: 'compiler',
    exports: [
      'CANONICAL_PROJECT_IR_VERSION',
      'CONFIG_FORM_COMPILER_VERSION',
      'compileCanonicalProject',
    ],
    name: '@moluoxixi/config-form-compiler',
    types: [
      'CanonicalNodeIR',
      'CanonicalPageIR',
      'CanonicalProjectIR',
      'CompileCanonicalProjectResult',
    ],
  },
  {
    directory: 'headless',
    exports: [
      'createConfigFormComponentMaterialRegistry',
      'createConfigFormComponentRegistry',
      'defineConfigFormComponentMaterial',
    ],
    name: '@moluoxixi/config-form-headless',
    types: [
      'ConfigFormComponentMaterial',
      'ConfigFormComponentMaterialMap',
      'ConfigFormComponentMaterialRegistry',
      'ConfigFormComponentRegistry',
    ],
  },
  {
    directory: 'designer',
    exports: [
      'createDesignerMaterialModuleRegistry',
      'defineDesignerFieldMaterial',
      'defineDesignerMaterialModule',
    ],
    name: '@moluoxixi/config-form-designer',
    types: [
      'DesignerFieldMaterialOptions',
      'DesignerFieldMaterialPropertyDefinition',
      'DesignerFieldMaterialValueDefinition',
      'DesignerMaterialModule',
      'DesignerMaterialModuleMap',
      'DesignerMaterialModuleRegistry',
    ],
  },
]
const adapters = [
  {
    directory: 'designer-antd-vue',
    exports: [
      'ANTD_VUE_DESIGNER_COMPONENTS',
      'ANTD_VUE_DESIGNER_MATERIALS',
      'ANTD_VUE_DESIGNER_MATERIAL_REGISTRY',
      'ANTD_VUE_DESIGNER_PROPERTY_CONTROLS',
      'ANTD_VUE_DESIGNER_ZH_CN',
      'ANTD_VUE_OPTION_RESOLVER_KEY',
      'antdVueDesignerRegistryLayer',
      'createAntdVueDesignerRegistry',
      'createAntdVueOptionDiagnostics',
      'createAntdVueOptionResolverContext',
      'createAntdVueOptionResolverPlugin',
      'normalizeAntdVueOptions',
      'provideAntdVueOptionResolver',
      'readAntdVueOptionSource',
      'useAntdVueOptionResolverContext',
      'useAntdVueResolvedOptions',
    ],
    name: '@moluoxixi/config-form-designer-antd-vue',
    types: [
      'AntdVueDesignerRegistryOptions',
      'AntdVueDesignerOption',
      'AntdVueOptionProvider',
      'AntdVueOptionProviderContext',
      'AntdVueOptionResolverConfig',
      'AntdVueOptionSource',
      'AntdVueOptionStatus',
      'AntdVueResolvedOptionState',
    ],
  },
  {
    directory: 'designer-element-plus',
    exports: [
      'ELEMENT_PLUS_DESIGNER_COMPONENTS',
      'ELEMENT_PLUS_DESIGNER_MATERIALS',
      'ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY',
      'ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS',
      'ELEMENT_PLUS_DESIGNER_ZH_CN',
      'ELEMENT_PLUS_OPTION_RESOLVER_KEY',
      'createElementPlusDesignerRegistry',
      'createElementPlusOptionDiagnostics',
      'createElementPlusOptionResolverContext',
      'createElementPlusOptionResolverPlugin',
      'elementPlusDesignerRegistryLayer',
      'elementPlusOptionKey',
      'normalizeElementPlusOptions',
      'provideElementPlusOptionResolver',
      'readElementPlusOptionSource',
      'useElementPlusOptionResolverContext',
      'useElementPlusResolvedOptions',
    ],
    name: '@moluoxixi/config-form-designer-element-plus',
    types: [
      'ElementPlusDesignerRegistryOptions',
      'ElementPlusDesignerOption',
      'ElementPlusOptionProvider',
      'ElementPlusOptionProviderContext',
      'ElementPlusOptionResolverConfig',
      'ElementPlusOptionSource',
      'ElementPlusOptionStatus',
      'ElementPlusResolvedOptionState',
    ],
  },
  {
    defaultExport: true,
    directory: 'antd',
    exports: [
      'ANTD_CONFIG_FORM_COMPONENTS',
      'ANTD_CONFIG_FORM_MATERIAL_REGISTRY',
      'AntdConfigForm',
      'default',
    ],
    name: '@moluoxixi/config-form-antd-vue',
    types: [
      'AntdConfigFormExpose',
      'AntdConfigFormNode',
      'AntdConfigFormProps',
    ],
  },
  {
    defaultExport: true,
    directory: 'element',
    exports: [
      'ELEMENT_CONFIG_FORM_COMPONENTS',
      'ELEMENT_CONFIG_FORM_MATERIAL_REGISTRY',
      'ElementConfigForm',
      'default',
    ],
    name: '@moluoxixi/config-form-element',
    types: [
      'ElementConfigFormExpose',
      'ElementConfigFormNode',
      'ElementConfigFormProps',
    ],
  },
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
]

function fail(message) {
  throw new Error(`[ConfigForm adapter package] ${message}`)
}

function verifyPublicContractPackages() {
  for (const contractPackage of publicContractPackages) {
    const packageDir = resolve(rootDir, 'packages', 'ConfigForm', contractPackage.directory)
    const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
    const rootExport = manifest.exports?.['.']
    if (!rootExport?.import || !rootExport?.types)
      fail(`${contractPackage.name} must expose import and types conditions at the package root`)

    if (!existsSync(resolve(packageDir, rootExport.import)) || !existsSync(resolve(packageDir, rootExport.types)))
      fail(`${contractPackage.name} build output or declarations are missing`)

    const importCheck = `
      const loaded = await import(${JSON.stringify(contractPackage.name)})
      const missing = ${JSON.stringify(contractPackage.exports)}.filter(name => !(name in loaded))
      if (missing.length > 0) throw new Error('Missing public exports: ' + missing.join(','))
    `
    const importResult = spawnSync(process.execPath, ['--input-type=module', '--eval', importCheck], {
      cwd: packageDir,
      encoding: 'utf8',
    })
    if (importResult.status !== 0)
      fail(`${contractPackage.name} self-reference failed: ${importResult.stderr || importResult.stdout}`)

    const consumerDir = mkdtempSync(resolve(packageDir, '.config-form-registry-smoke-'))
    try {
      writeFileSync(resolve(consumerDir, 'consumer.ts'), `
        import { ${contractPackage.exports.join(', ')} } from ${JSON.stringify(contractPackage.name)}
        import type { ${contractPackage.types.join(', ')} } from ${JSON.stringify(contractPackage.name)}

        void [${contractPackage.exports.join(', ')}]
        type PublicTypes = [${(contractPackage.typeUsages ?? contractPackage.types).join(', ')}]
        const publicTypes: PublicTypes | undefined = undefined
        void publicTypes
      `)
      writeFileSync(resolve(consumerDir, 'tsconfig.json'), JSON.stringify({
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
      const typeResult = spawnSync(process.execPath, [tscPath, '--project', resolve(consumerDir, 'tsconfig.json')], {
        cwd: consumerDir,
        encoding: 'utf8',
      })
      if (typeResult.status !== 0)
        fail(`${contractPackage.name} TypeScript consumer failed: ${typeResult.stderr || typeResult.stdout}`)
    }
    finally {
      rmSync(consumerDir, { force: true, recursive: true })
    }
  }
}

function verifyRuntimePackage() {
  const packageDir = resolve(rootDir, 'packages', 'ConfigForm', 'runtime')
  const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'))
  const runtimeExport = manifest.exports?.['.']

  if (Object.hasOwn(manifest.exports ?? {}, './renderer'))
    fail('@moluoxixi/config-form must not expose the removed renderer subpath')
  if (!runtimeExport?.source || !runtimeExport?.import || !runtimeExport?.types)
    fail('@moluoxixi/config-form must expose source, import, and types conditions at the package root')

  const bundlePath = resolve(packageDir, runtimeExport.import)
  const declarationsPath = resolve(packageDir, runtimeExport.types)
  if (!existsSync(bundlePath) || !existsSync(declarationsPath))
    fail('@moluoxixi/config-form build output or declarations are missing')

  const importCheck = `
    const loaded = await import('@moluoxixi/config-form')
    const expected = [
      'ConfigForm',
      'ConfigFormError',
      'ConfigFormRenderer',
      'FormLayout',
      'asVueFunctionalComponent',
      'createConfigFormRendererExpose',
      'defineField',
      'defineFields',
      'resolveConfigFormFieldLayout',
      'resolveConfigFormLayout',
      'resolveConfigFormNodeSpan',
      'useForm',
      'withConfigFormInstall',
    ].sort()
    const actual = Object.keys(loaded).sort()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Unexpected runtime exports: ' + actual.join(','))
    }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', importCheck], {
    cwd: packageDir,
    encoding: 'utf8',
  })
  if (result.status !== 0)
    fail(`@moluoxixi/config-form package self-reference failed: ${result.stderr || result.stdout}`)

  const consumerDir = mkdtempSync(resolve(packageDir, '.config-form-runtime-smoke-'))
  try {
    writeFileSync(resolve(consumerDir, 'consumer.ts'), `
      import {
        ConfigFormRenderer,
        createConfigFormRendererExpose,
        resolveConfigFormFieldLayout,
        resolveConfigFormLayout,
        resolveConfigFormNodeSpan,
        withConfigFormInstall,
      } from '@moluoxixi/config-form'
      import type {
        ConfigFormBreakpoint,
        ConfigFormComponentRegistration,
        ConfigFormComponentRegistry,
        ConfigFormFieldLayout,
        ConfigFormLabelPosition,
        ConfigFormResolvedLayout,
        ConfigFormRendererComponent,
        ConfigFormRendererComponentInstance,
        ConfigFormRendererComponentProps,
        ConfigFormRendererExpose,
        ConfigFormRendererProps,
        ConfigFormRuntimeEditorBridge,
        ConfigFormResponsiveLayout,
        InstallableConfigFormComponent,
      } from '@moluoxixi/config-form'

      const responsive: ConfigFormResponsiveLayout = { tablet: { columns: 12 } }
      const registration: ConfigFormComponentRegistration = { component: ConfigFormRenderer }
      const components: ConfigFormComponentRegistry = { renderer: registration }
      const breakpoint: ConfigFormBreakpoint = 'tablet'
      const labelPosition: ConfigFormLabelPosition = 'left'
      const layout: ConfigFormResolvedLayout = resolveConfigFormLayout(24, 24, responsive, breakpoint)
      const fieldLayout: ConfigFormFieldLayout = resolveConfigFormFieldLayout(labelPosition, true)
      const nodeSpan = resolveConfigFormNodeSpan(12, layout)
      void [
        ConfigFormRenderer,
        components,
        createConfigFormRendererExpose,
        fieldLayout,
        layout,
        nodeSpan,
        withConfigFormInstall,
      ]
      const typedRenderer: ConfigFormRendererComponent = ConfigFormRenderer
      void typedRenderer
      type RendererTypes = [
        ConfigFormRendererComponentInstance,
        ConfigFormRendererComponentProps,
        ConfigFormRendererExpose,
        ConfigFormRendererProps,
        ConfigFormRuntimeEditorBridge,
        ConfigFormComponentRegistration,
        ConfigFormComponentRegistry,
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
      fail(`@moluoxixi/config-form declaration consumer failed: ${declarationsResult.stderr || declarationsResult.stdout}`)
    }

    const vueTscPath = resolve(packageDir, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js')
    const sourceResult = spawnSync(process.execPath, [vueTscPath, '--project', sourceConfigPath], {
      cwd: consumerDir,
      encoding: 'utf8',
    })
    if (sourceResult.status !== 0)
      fail(`@moluoxixi/config-form source consumer failed: ${sourceResult.stderr || sourceResult.stdout}`)
  }
  finally {
    rmSync(consumerDir, { force: true, recursive: true })
  }
}

verifyPublicContractPackages()
verifyRuntimePackage()

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
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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
    const namedExports = adapter.exports.filter(name => name !== 'default')
    const defaultImport = adapter.defaultExport
      ? `import AdapterDefault from ${JSON.stringify(adapter.name)}`
      : ''
    writeFileSync(consumerPath, `
      ${defaultImport}
      import { ${namedExports.join(', ')} } from ${JSON.stringify(adapter.name)}
      import type { ${adapter.types.join(', ')} } from ${JSON.stringify(adapter.name)}

      void [${adapter.defaultExport ? 'AdapterDefault, ' : ''}${namedExports.join(', ')}]
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

console.log('PASS ConfigForm public package boundaries')
