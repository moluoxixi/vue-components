import type { CanonicalSourceLibraryBinding } from '../types'
import type { PackageJson, StandaloneSourceProject } from '../types/source'
import { safeProjectSlug } from '../../utils'
import { escapeHtml, quote } from './source-serialization'

export function sourceStyles(): string {
  return `:root { color: #18212b; background: #eef2f6; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
button, input, select, textarea { font: inherit; }
.source-page { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 64px; }
.source-header { margin-bottom: 28px; }
.source-kicker { margin: 0 0 8px; color: #2563eb; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.source-header h1 { margin: 0; font-size: 32px; }
.source-header p:last-child { color: #586574; }
.source-page > [data-config-form-responsive-root] { padding: 24px; border: 1px solid #d5dce5; border-radius: 8px; background: #fff; }
.source-submit { min-height: 38px; margin-top: 20px; padding: 0 16px; color: #fff; border: 0; border-radius: 5px; background: #1d4ed8; cursor: pointer; }
.source-field-error { margin: 12px 0 0; color: #b42318; font-size: 13px; }
.source-result { margin-top: 20px; padding: 16px; overflow: auto; color: #d7f9e4; border-radius: 5px; background: #17212b; }
[data-config-form-array] { display: grid; gap: 12px; }
[data-config-form-row] { display: grid; gap: 8px; padding: 12px; border: 1px solid #d5dce5; border-radius: 6px; }
[data-config-form-row-actions], [data-config-form-array-actions] { display: flex; gap: 6px; justify-content: flex-end; }
@media (max-width: 720px) { .source-page { width: min(100% - 20px, 920px); padding-top: 24px; } .source-page > [data-config-form-responsive-root] { padding: 16px; } .source-header h1 { font-size: 26px; } }
`
}

function portableDependencyVersion(packageName: string, dependencies: Record<string, string>): string {
  const version = dependencies[packageName]
  if (!version || /^(?:workspace:|catalog:)/.test(version))
    throw new Error(`Source dependency "${packageName}" requires a portable version.`)
  return version
}

function sourcePackage(
  name: string,
  libraries: ReadonlyMap<string, CanonicalSourceLibraryBinding>,
  declaredDependencies: Record<string, string>,
): string {
  const dependencies = { ...declaredDependencies }
  const runtimeDependencies = Object.fromEntries([...libraries.keys()].sort().map(packageName => [
    packageName,
    portableDependencyVersion(packageName, dependencies),
  ]))
  const manifest = {
    name: name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    private: true,
    type: 'module',
    version: '0.0.0',
    packageManager: 'pnpm@10.29.3',
    engines: { node: '>=22.6.0' },
    scripts: {
      build: 'vue-tsc -p tsconfig.json --noEmit && vite build',
      dev: 'vite',
      typecheck: 'vue-tsc -p tsconfig.json --noEmit',
    },
    dependencies: {
      '@lucide/vue': '^1.28.0',
      '@moluoxixi/zod3-to-rule': '^0.1.2',
      'zod': '^3.24.2',
      'vue': portableDependencyVersion('vue', { vue: dependencies.vue ?? '3.5.33' }),
      ...runtimeDependencies,
    },
    devDependencies: {
      '@vitejs/plugin-vue': '5.2.3',
      'typescript': '5.8.2',
      'vite': '6.2.0',
      'vue-tsc': '2.2.8',
      'sass': '1.103.1',
    },
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function canonicalProjectPackage(
  name: string,
  libraries: ReadonlyMap<string, CanonicalSourceLibraryBinding>,
): string {
  const declaredDependencies = Object.fromEntries([...libraries.values()].map(library => [
    library.packageName,
    library.version,
  ]))
  const manifest = JSON.parse(sourcePackage(name, libraries, declaredDependencies)) as PackageJson
  manifest.dependencies = {
    ...manifest.dependencies,
    '@moluoxixi/config-form-prototype-runtime': '^0.1.0',
    'vue-router': '4.5.1',
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function mainSource(
  libraries: ReadonlyMap<string, CanonicalSourceLibraryBinding>,
  withRouter: boolean,
): string {
  const entries = [...libraries.values()].sort((left, right) => left.packageName.localeCompare(right.packageName))
  const imports = entries.flatMap(library => [
    `import ${library.plugin} from ${quote(library.packageName)}`,
    ...(library.stylesheet ? [`import ${quote(library.stylesheet)}`] : []),
  ])
  const appUses = [
    ...(withRouter ? ['router'] : []),
    ...entries.map(library => library.plugin),
  ].map(plugin => `.use(${plugin})`).join('')
  return `import { createApp } from 'vue'
import App from './App.vue'
${withRouter ? `import { router } from './router'\n` : ''}${imports.join('\n')}${imports.length ? '\n' : ''}import '@moluoxixi/config-form-prototype-runtime/vue/style'
import './runtime/vue/styles/index.scss'
import './styles.css'

const app = createApp(App)${appUses}
${withRouter
  ? `
async function mountApp(): Promise<void> {
  await router.isReady()
  app.mount('#app')
}

void mountApp()
`
  : 'app.mount(\'#app\')\n'}`
}

export function projectAppSource(
  project: Pick<StandaloneSourceProject, 'surfaces'>,
  surfaceDirectories: ReadonlyMap<string, string>,
): string {
  const imports = project.surfaces.map((surface, index) => (
    `import Surface${index + 1} from './surfaces/${surfaceDirectories.get(surface.id)}/Surface.vue'`
  )).join('\n')
  const artifacts = project.surfaces.map((surface, index) => (
    `  ${quote(surface.id)}: { surfaceId: ${quote(surface.id)}, component: Surface${index + 1} },`
  )).join('\n')
  return `<script setup lang="ts">
import type { PrototypeProjectContextV1 } from '@moluoxixi/config-form-prototype-runtime/session'
import type { PrototypeVueSurfaceArtifact, PrototypeVueTransitionSnapshot } from '@moluoxixi/config-form-prototype-runtime/vue'
import { PrototypeSurfaceHost } from '@moluoxixi/config-form-prototype-runtime/vue'
${imports}
import { prototypeContext } from './prototype-context'
import { router } from './router'

const artifactsBySurfaceId = {
${artifacts}
} satisfies Readonly<Record<string, PrototypeVueSurfaceArtifact>>

const context: PrototypeProjectContextV1 = prototypeContext
const requestedSurfaceId = typeof router.currentRoute.value.name === 'string'
  ? router.currentRoute.value.name
  : undefined
const requestedSurface = requestedSurfaceId
  ? context.surfacesById[requestedSurfaceId]
  : undefined
const initialContext: PrototypeProjectContextV1 = Object.freeze({
  ...context,
  homeSurfaceId: requestedSurface?.kind === 'page'
    ? requestedSurface.id
    : context.homeSurfaceId,
})

function syncPageRoute(snapshot: PrototypeVueTransitionSnapshot): void {
  const instanceId = snapshot.session.pageHistory.at(-1)
  const instance = instanceId ? snapshot.session.instancesById[instanceId] : undefined
  const surface = instance ? initialContext.surfacesById[instance.surfaceId] : undefined
  if (surface?.kind === 'page' && router.currentRoute.value.path !== surface.route)
    void router.replace(surface.route)
}
</script>

<template>
  <PrototypeSurfaceHost
    :artifacts-by-surface-id="artifactsBySurfaceId"
    :context="initialContext"
    @transition="syncPageRoute"
  />
</template>
`
}

export const standaloneViteConfig = `import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue()],
})
`

export const standaloneTsconfig = `${JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    useDefineForClassFields: true,
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    strict: true,
    skipLibCheck: true,
    isolatedModules: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    jsx: 'preserve',
    jsxImportSource: 'vue',
    noEmit: true,
    types: ['vite/client'],
  },
  include: ['src/**/*.ts', 'src/**/*.vue'],
}, null, 2)}\n`

export function standaloneHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}

export function projectRouterSource(
  project: Pick<StandaloneSourceProject, 'homeSurfaceId' | 'surfaces'>,
): string {
  const pages = project.surfaces.filter((surface): surface is Extract<StandaloneSourceProject['surfaces'][number], { kind: 'page' }> => surface.kind === 'page')
  const routes = pages.map(page => `  { path: ${quote(page.route)}, name: ${quote(page.id)}, component: SurfaceRoute },`).join('\n')
  const home = pages.find(page => page.id === project.homeSurfaceId)!
  const redirect = home.route === '/'
    ? ''
    : `\n  { path: '/', redirect: ${quote(home.route)} },`
  return `import { defineComponent } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

const SurfaceRoute = defineComponent({ name: 'GeneratedSurfaceRoute', render: () => null })

export const router = createRouter({
  history: createWebHistory(),
  routes: [${redirect}
${routes}
  ],
})
`
}

export function uniqueSurfaceDirectories(project: Pick<StandaloneSourceProject, 'surfaces'>): ReadonlyMap<string, string> {
  const used = new Set<string>()
  return new Map(project.surfaces.map((surface) => {
    const base = safeProjectSlug(surface.id)
    let directory = base
    let suffix = 2
    while (used.has(directory)) {
      directory = `${base}-${suffix}`
      suffix += 1
    }
    used.add(directory)
    return [surface.id, directory]
  }))
}
