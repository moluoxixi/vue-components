import type { ImportMap } from '@vue/repl/core'
import type {
  ElementPlusDocsReplCdn,
  ElementPlusDocsReplPackage,
} from './types'

interface Dependency {
  path: string
  pkg?: string
  version?: string
}

export function createElementPlusDocsCdnUrl(
  cdn: ElementPlusDocsReplCdn,
  pkg: string,
  version: string | undefined,
  path: string,
): string {
  const packageVersion = version ? `@${version}` : ''
  if (cdn === 'unpkg')
    return `https://unpkg.com/${pkg}${packageVersion}${path}`
  if (cdn === 'jsdelivr-fastly')
    return `https://fastly.jsdelivr.net/npm/${pkg}${packageVersion}${path}`
  return `https://cdn.jsdelivr.net/npm/${pkg}${packageVersion}${path}`
}

export function createElementPlusDocsCompilerUrl(
  cdn: ElementPlusDocsReplCdn,
  version: string,
): string {
  return createElementPlusDocsCdnUrl(
    cdn,
    '@vue/compiler-sfc',
    version,
    '/dist/compiler-sfc.esm-browser.js',
  )
}

export function createElementPlusDocsReplImportMap(options: {
  cdn: ElementPlusDocsReplCdn
  componentPackage: ElementPlusDocsReplPackage
  elementPlusVersion: string
  vueVersion: string
}): ImportMap {
  const dependencies: Record<string, Dependency> = {
    'vue': {
      pkg: '@vue/runtime-dom',
      version: options.vueVersion,
      path: '/dist/runtime-dom.esm-browser.js',
    },
    '@vue/shared': {
      version: options.vueVersion,
      path: '/dist/shared.esm-bundler.js',
    },
    'element-plus': {
      version: options.elementPlusVersion,
      path: '/dist/index.full.min.mjs',
    },
    'element-plus/': {
      version: options.elementPlusVersion,
      path: '/',
    },
    '@element-plus/icons-vue': {
      version: '2',
      path: '/dist/index.min.js',
    },
  }

  const imports = Object.fromEntries(
    Object.entries(dependencies).map(([specifier, dependency]) => [
      specifier,
      createElementPlusDocsCdnUrl(
        options.cdn,
        dependency.pkg ?? specifier,
        dependency.version,
        dependency.path,
      ),
    ]),
  )
  imports[options.componentPackage.name] = options.componentPackage.moduleUrl

  return { imports }
}

export async function fetchElementPlusDocsPackageVersions(
  packageName: string,
): Promise<string[]> {
  const response = await fetch(`https://data.jsdelivr.com/v1/package/npm/${packageName}`)
  if (!response.ok)
    throw new Error(`Unable to load ${packageName} versions (${response.status})`)
  const payload = await response.json() as { versions?: unknown }
  return Array.isArray(payload.versions)
    ? payload.versions.filter((version): version is string => typeof version === 'string')
    : []
}
