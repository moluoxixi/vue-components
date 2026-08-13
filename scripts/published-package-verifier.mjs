function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStylesheetTarget(target) {
  return typeof target === 'string' && /\.(?:css|less|sass|scss)(?:$|\?)/.test(target)
}

export const browserJavaScriptEntrypointAllowlist = Object.freeze({
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
    './RichTextEditor',
    './configForm',
    './element',
    './antd',
  ],
  '@moluoxixi/rich-text-editor': ['.'],
  '@moluoxixi/vitepress-theme-element-plus': ['./repl'],
})

export const browserJavaScriptEntrypointExclusions = Object.freeze({
  '@moluoxixi/vitepress-theme-element-plus': ['.', './markdown'],
})

export const browserStylesheetEntrypointAllowlist = Object.freeze({
  '@moluoxixi/components': ['./styles'],
  '@moluoxixi/rich-text-editor': ['./styles'],
  '@moluoxixi/vitepress-theme-element-plus': ['./repl.css'],
})

export function importName(name) {
  return name.replace(/[^\w$]/g, '_')
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
