function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStylesheetTarget(target) {
  return typeof target === 'string' && /\.(?:css|less|sass|scss)(?:$|\?)/.test(target)
}

export const browserJavaScriptEntrypointAllowlist = Object.freeze({
  '@moluoxixi/ai-doc-assistant': ['./protocol', './api-contract'],
  '@moluoxixi/ai-provider': ['.', './shared'],
  '@moluoxixi/i18n-tool': ['./protocol'],
  '@moluoxixi/components': [
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
  ],
  '@moluoxixi/rich-text-editor': ['.'],
  '@moluoxixi/vitepress-theme-element-plus': ['./repl', './repository'],
})

export const browserJavaScriptEntrypointExclusions = Object.freeze({
  '@moluoxixi/ai-doc-assistant': ['.', './plugin'],
  '@moluoxixi/ai-provider': ['./server'],
  '@moluoxixi/i18n-tool': ['.', './config', './core', './server'],
  '@moluoxixi/vitepress-theme-element-plus': ['.', './markdown', './node', './repository/node'],
})

export const isolatedBrowserJavaScriptEntries = Object.freeze([
  '@moluoxixi/vitepress-theme-element-plus/repl',
])

export const browserStylesheetEntrypointAllowlist = Object.freeze({
  '@moluoxixi/components': ['./styles'],
  '@moluoxixi/rich-text-editor': ['./styles'],
  '@moluoxixi/vitepress-theme-element-plus': ['./repl.css'],
})

export const nodeJavaScriptRuntimeEntrypointAllowlist = Object.freeze({
  '@moluoxixi/ai-doc-assistant': ['./plugin'],
  '@moluoxixi/ai-provider': ['./server'],
  '@moluoxixi/i18n-tool': ['./config', './core', './server'],
  '@moluoxixi/vitepress-theme-element-plus': ['./node', './repository/node'],
})

export const browserBundleForbiddenFragments = Object.freeze({
  '@moluoxixi/ai-doc-assistant': [
    'createLanguageModel',
    'createEmbeddingModel',
    'loadProviderConfig',
    'ServerContext',
    'AI_DOC_CHAT_API_KEY',
    'AI_DOC_EMBEDDING_API_KEY',
    'node:crypto',
    'apiKey',
  ],
  '@moluoxixi/ai-provider': [
    'createLanguageModel',
    'createEmbeddingModel',
    'getAiProviderErrorCause',
    'apiKey',
  ],
  '@moluoxixi/i18n-tool': [
    'absolutePath',
    'apiKeyEnv',
    'node:fs',
    'writeTextAtomically',
  ],
})

export const packedBrowserApplicationAllowlist = Object.freeze({
  '@moluoxixi/ai-doc-assistant': Object.freeze({
    directory: 'dist/ui',
    mountPath: '/__ai-doc/',
    readySelector: '[data-testid="app-title"]',
  }),
})

export function getPackedBrowserApplications(
  manifests,
  applications = packedBrowserApplicationAllowlist,
  forbiddenRules = browserBundleForbiddenFragments,
) {
  const packageNames = new Set(manifests.map(manifest => manifest.name))
  return Object.entries(applications).map(([packageName, application]) => {
    if (!packageNames.has(packageName))
      throw new Error(`Packed browser application package ${packageName} is not publishable.`)
    return {
      packageName,
      ...application,
      forbiddenFragments: [...(forbiddenRules[packageName] ?? [])],
    }
  })
}

export function getBrowserBundleForbiddenFragments(
  manifests,
  rules = browserBundleForbiddenFragments,
) {
  const packageNames = new Set(manifests.map(manifest => manifest.name))
  return Object.entries(rules).flatMap(([packageName, fragments]) => {
    if (!packageNames.has(packageName))
      throw new Error(`Browser bundle safety package ${packageName} is not publishable.`)
    return fragments
  })
}

export function importName(name) {
  return name.replace(/[^\w$]/g, '_')
}

export function getPnpmCommandName(platform) {
  return platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

export function getTypedJavaScriptEntrypoints(manifest) {
  if (!isRecord(manifest?.exports))
    return []

  return Object.entries(manifest.exports)
    .filter(([, conditions]) => (
      isRecord(conditions)
      && typeof conditions.types === 'string'
      && typeof conditions.import === 'string'
      && !isStylesheetTarget(conditions.import)
    ))
    .map(([subpath]) => subpath)
}

export function getStylesheetEntrypoints(manifest) {
  if (!isRecord(manifest?.exports))
    return []

  return Object.entries(manifest.exports)
    .filter(([subpath, conditions]) => (
      !subpath.includes('*')
      && (
        isStylesheetTarget(conditions)
        || (isRecord(conditions) && isStylesheetTarget(conditions.import))
      )
    ))
    .map(([subpath]) => subpath)
}

export function getPublicSpecifier(packageName, subpath) {
  return subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
}

export function getBrowserConsumerSpecifiers(
  manifests,
  javaScriptAllowlist = browserJavaScriptEntrypointAllowlist,
  stylesheetAllowlist = browserStylesheetEntrypointAllowlist,
) {
  const manifestsByName = new Map(manifests.map(manifest => [manifest.name, manifest]))

  function selectEntrypoints(allowlist, discover, kind) {
    return Object.entries(allowlist).flatMap(([packageName, requestedSubpaths]) => {
      const manifest = manifestsByName.get(packageName)
      if (!manifest)
        throw new Error(`Browser smoke package ${packageName} is not publishable.`)

      const availableSubpaths = discover(manifest).filter(subpath => !subpath.includes('*'))
      const selectedSubpaths = requestedSubpaths
      const excludedSubpaths = kind === 'JavaScript'
        ? browserJavaScriptEntrypointExclusions[packageName] ?? []
        : []
      const duplicateSubpaths = selectedSubpaths.filter(subpath => excludedSubpaths.includes(subpath))
      if (duplicateSubpaths.length > 0) {
        throw new Error(
          `Browser smoke ${kind} entries for ${packageName} are both included and excluded: ${duplicateSubpaths.join(', ')}.`,
        )
      }
      for (const subpath of selectedSubpaths) {
        if (!availableSubpaths.includes(subpath))
          throw new Error(`Browser smoke ${kind} entry ${getPublicSpecifier(packageName, subpath)} is not exported.`)
      }
      for (const subpath of excludedSubpaths) {
        if (!availableSubpaths.includes(subpath))
          throw new Error(`Browser smoke excluded ${kind} entry ${getPublicSpecifier(packageName, subpath)} is not exported.`)
      }
      const classifiedSubpaths = new Set([...selectedSubpaths, ...excludedSubpaths])
      const unclassifiedSubpaths = availableSubpaths.filter(subpath => !classifiedSubpaths.has(subpath))
      if (unclassifiedSubpaths.length > 0) {
        throw new Error(
          `Browser smoke ${kind} entries for ${packageName} are not classified: ${unclassifiedSubpaths.join(', ')}.`,
        )
      }
      return selectedSubpaths.map(subpath => getPublicSpecifier(packageName, subpath))
    })
  }

  return {
    javaScript: selectEntrypoints(javaScriptAllowlist, getTypedJavaScriptEntrypoints, 'JavaScript'),
    stylesheets: selectEntrypoints(stylesheetAllowlist, getStylesheetEntrypoints, 'stylesheet'),
  }
}

export function createNodeSmokeSource(runtimeEntries, consumerEntries) {
  const runtimeImports = runtimeEntries.map((specifier, index) => (
    `import * as ${importName(`${specifier}_${index}`)} from ${JSON.stringify(specifier)};`
  ))
  const runtimeAssertions = runtimeEntries.map((specifier, index) => (
    `if (!${importName(`${specifier}_${index}`)}) throw new Error(${JSON.stringify(`Unable to import ${specifier}`)});`
  ))
  const resolutionAssertions = consumerEntries.map(specifier => (
    `if (!import.meta.resolve(${JSON.stringify(specifier)})) throw new Error(${JSON.stringify(`Unable to resolve ${specifier}`)});`
  ))

  return [...runtimeImports, ...runtimeAssertions, ...resolutionAssertions].join('\n')
}

export function createTypeSmokeSource(consumerEntries) {
  return consumerEntries.map(specifier => `import ${JSON.stringify(specifier)};`).join('\n')
}

export function getNodeRuntimeSpecifiers(
  manifests,
  allowlist = nodeJavaScriptRuntimeEntrypointAllowlist,
) {
  const manifestsByName = new Map(manifests.map(manifest => [manifest.name, manifest]))
  return Object.entries(allowlist).flatMap(([packageName, subpaths]) => {
    const manifest = manifestsByName.get(packageName)
    if (!manifest)
      throw new Error(`Node smoke package ${packageName} is not publishable.`)
    const available = getTypedJavaScriptEntrypoints(manifest)
    for (const subpath of subpaths) {
      if (!available.includes(subpath))
        throw new Error(`Node smoke entry ${getPublicSpecifier(packageName, subpath)} is not exported.`)
    }
    return subpaths.map(subpath => getPublicSpecifier(packageName, subpath))
  })
}

export function createPackedConsumerManifest({
  browserBundlerVersion,
  packageManager,
  packedDependencies,
}) {
  return {
    dependencies: packedDependencies,
    ...(browserBundlerVersion
      ? { devDependencies: { vite: browserBundlerVersion } }
      : {}),
    packageManager,
    private: true,
    type: 'module',
  }
}

export function createBrowserBuildArgs(consumerDirectory, browserDirectory) {
  return ['--dir', consumerDirectory, 'exec', 'vite', 'build', browserDirectory]
}

export function createBrowserConsumerBatches(
  specifiers,
  maxJavaScriptEntries = 4,
  isolatedJavaScriptEntries = isolatedBrowserJavaScriptEntries,
) {
  if (!Number.isInteger(maxJavaScriptEntries) || maxJavaScriptEntries <= 0)
    throw new Error('Browser consumer batch size must be a positive integer.')

  if (specifiers.javaScript.length === 0) {
    return specifiers.stylesheets.length > 0
      ? [{ javaScript: [], stylesheets: [...specifiers.stylesheets] }]
      : []
  }

  const batches = []
  const isolatedEntries = new Set(isolatedJavaScriptEntries)
  let pendingEntries = []
  const flushPendingEntries = () => {
    if (pendingEntries.length === 0)
      return
    batches.push({
      javaScript: pendingEntries,
      stylesheets: [...specifiers.stylesheets],
    })
    pendingEntries = []
  }
  for (const entry of specifiers.javaScript) {
    if (isolatedEntries.has(entry)) {
      flushPendingEntries()
      batches.push({
        javaScript: [entry],
        stylesheets: [...specifiers.stylesheets],
      })
      continue
    }
    pendingEntries.push(entry)
    if (pendingEntries.length === maxJavaScriptEntries)
      flushPendingEntries()
  }
  flushPendingEntries()
  return batches
}

export function createBrowserViteConfigSource(javaScriptEntries) {
  if (!javaScriptEntries.includes('@moluoxixi/vitepress-theme-element-plus/repl'))
    return 'export default {"resolve":{"alias":[]}}'

  return [
    `import { resolve } from 'node:path'`,
    `const replContractStub = resolve(import.meta.dirname, 'src/vue-repl-contract-stub.mjs')`,
    `export default {`,
    `  resolve: {`,
    `    alias: [`,
    `      { find: '@vue/repl/monaco-editor', replacement: '@vue/repl/codemirror-editor' },`,
    `      { find: '@vue/repl/core', replacement: replContractStub },`,
    `      { find: /^@vue\\/repl$/, replacement: replContractStub },`,
    `    ],`,
    `  },`,
    `}`,
  ].join('\n')
}

export function createBrowserReplContractStubSource() {
  return [
    `export const Repl = Object.freeze({})`,
    `export class File {}`,
    `export async function compileFile() {}`,
    `export function useStore() { return {} }`,
  ].join('\n')
}

export function createBrowserSmokeSource(javaScriptEntries, stylesheetEntries) {
  const moduleImports = javaScriptEntries.map((specifier, index) => (
    `import * as browserEntry${index} from ${JSON.stringify(specifier)};`
  ))
  const stylesheetImports = stylesheetEntries.map(specifier => `import ${JSON.stringify(specifier)};`)
  const moduleReferences = javaScriptEntries.map((_, index) => `browserEntry${index}`)

  return [
    ...moduleImports,
    ...stylesheetImports,
    `requestAnimationFrame(() => {`,
    `  const stylesheetText = Array.from(document.styleSheets)`,
    `    .flatMap(sheet => Array.from(sheet.cssRules, rule => rule.cssText))`,
    `    .join('\\n');`,
    `  window.__PACKED_BROWSER_SMOKE__ = {`,
    `    javaScript: [${moduleReferences.join(', ')}].every(entry => Object.keys(entry).length > 0),`,
    `    copyTextStyles: stylesheetText.includes('.mx-copy-text'),`,
    `    richTextStyles: stylesheetText.includes('.mx-rich-text-editor'),`,
    `    replStyles: getComputedStyle(document.documentElement).getPropertyValue('--mx-repl-bg').trim() !== '',`,
    `  };`,
    `});`,
  ].join('\n')
}
