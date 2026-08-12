import type { ElementPlusDocsExternalProject } from './vue-project'
import { compressToBase64 } from 'lz-string'
import { submitElementPlusDocsProjectForm } from './submit-form'

const defaultCodeSandboxUrl = 'https://codesandbox.io/api/v1/sandboxes/define'
const codeSandboxEntryPath = 'main.js'
const codeSandboxDemoPath = 'demo.js'
const codeSandboxRuntimePath = 'load-module.js'
const sharedEntryPath = 'src/main.ts'
const sfcEntryPath = 'src/App.vue'
const virtualSfcEntryPath = '/__mx_docs_sfc__/demo.vue'
const sfcLoaderUrl = 'https://cdn.jsdelivr.net/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.esm.js'

const codeSandboxHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vue component demo</title>
    <style>
      body { margin: 0; padding: 24px; font-family: Inter, system-ui, sans-serif; }
      #app { min-height: 40px; }
      .mx-codesandbox-error { margin: 0; color: #c45656; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <div id="app">Loading demo...</div>
    <script type="module" src="./main.js"></script>
  </body>
</html>
`

export interface ElementPlusDocsCodeSandboxFile {
  content: string
  isBinary: false
}

export interface ElementPlusDocsCodeSandboxPayload {
  files: Readonly<Record<string, ElementPlusDocsCodeSandboxFile>>
}

export interface ElementPlusDocsCodeSandboxOptions {
  query?: string
  url?: string
}

interface ElementPlusDocsExternalPackageJson {
  dependencies?: Record<string, string>
  name?: string
}

function resolveProjectDependencies(
  project: ElementPlusDocsExternalProject,
): Readonly<Record<string, string>> {
  if (project.dependencies)
    return project.dependencies

  const packageJson = JSON.parse(project.files['package.json'] ?? '{}') as ElementPlusDocsExternalPackageJson
  return packageJson.dependencies ?? {}
}

function resolveProjectStyleImports(project: ElementPlusDocsExternalProject): readonly string[] {
  if (project.styleImports)
    return project.styleImports

  return [...(project.files[sharedEntryPath] ?? '').matchAll(/^import (['"])([^'"]+)\1;?$/gm)]
    .map(match => match[2]!)
}

function createCodeSandboxDemoSource(source: string): string {
  const escapedSource = source
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${')

  return `export default \`${escapedSource}\`\n`
}

function createCodeSandboxPackageJson(
  project: ElementPlusDocsExternalProject,
  dependencies: Readonly<Record<string, string>>,
  styleImports: readonly string[],
): string {
  const sourcePackageJson = JSON.parse(project.files['package.json'] ?? '{}') as ElementPlusDocsExternalPackageJson
  return `${JSON.stringify({
    name: sourcePackageJson.name ?? 'element-plus-docs-demo',
    private: true,
    description: project.description ?? 'An editable component documentation demo',
    dependencies,
    elementPlusDocs: { styleImports },
  }, null, 2)}\n`
}

function createCodeSandboxEntry(): string {
  return `import demoSource from './${codeSandboxDemoPath}'
import { mountDemo } from './${codeSandboxRuntimePath}'

async function loadProjectConfig() {
  const response = await fetch(new URL('./package.json', import.meta.url))
  if (!response.ok)
    throw new Error('Unable to load package.json: ' + response.status + ' ' + response.statusText)
  return response.json()
}

try {
  const packageJson = await loadProjectConfig()
  await mountDemo({
    demoSource,
    dependencies: packageJson.dependencies ?? {},
    styleImports: packageJson.elementPlusDocs?.styleImports ?? [],
    target: '#app',
  })
}
catch (error) {
  const root = document.querySelector('#app')
  const output = document.createElement('pre')
  output.className = 'mx-codesandbox-error'
  output.textContent = error instanceof Error ? error.stack ?? error.message : String(error)
  root?.replaceChildren(output)
  console.error(error)
}
`
}

function createCodeSandboxRuntime(): string {
  return `import { loadModule } from ${JSON.stringify(sfcLoaderUrl)}

const virtualEntryPath = ${JSON.stringify(virtualSfcEntryPath)}
const modulePromises = new Map()

function splitPackage(specifier) {
  const parts = specifier.split('/')
  return specifier.startsWith('@')
    ? { name: parts.slice(0, 2).join('/'), subpath: parts.slice(2).join('/') }
    : { name: parts[0], subpath: parts.slice(1).join('/') }
}

function normalizeVersion(version) {
  return /^(?:workspace:|file:|link:)/.test(version) ? 'latest' : version
}

function createModuleUrl(specifier, dependencies) {
  const { name, subpath } = splitPackage(specifier)
  const version = encodeURIComponent(normalizeVersion(dependencies[name] ?? 'latest'))
  return 'https://cdn.jsdelivr.net/npm/' + name + '@' + version
    + (subpath ? '/' + subpath : '') + '/+esm'
}

function importPackage(specifier, dependencies) {
  if (!modulePromises.has(specifier))
    modulePromises.set(specifier, import(createModuleUrl(specifier, dependencies)))
  return modulePromises.get(specifier)
}

export async function mountDemo({ demoSource, dependencies, styleImports, target }) {
  const injectedStyles = []
  try {
    const Vue = await importPackage('vue', dependencies)
    await Promise.all(styleImports.map(specifier => importPackage(specifier, dependencies)))
    const moduleCache = Object.assign(Object.create(null), { vue: Vue })
    const App = await loadModule(virtualEntryPath, {
      moduleCache,
      async loadModule(requestedModule) {
        const specifier = String(requestedModule)
        if (specifier === 'vue')
          return Vue
        if (specifier.startsWith('.') || specifier.startsWith('/'))
          return undefined
        return importPackage(specifier, dependencies)
      },
      async getFile(requestedPath) {
        const path = String(requestedPath)
        if (path !== virtualEntryPath)
          throw new Error('Unsupported SFC file request: ' + path)
        return {
          type: '.vue',
          getContentData: () => demoSource,
        }
      },
      addStyle(css) {
        const style = document.createElement('style')
        style.textContent = css
        document.head.append(style)
        injectedStyles.push(style)
      },
    })
    return Vue.createApp(App).mount(target)
  }
  catch (error) {
    injectedStyles.forEach(style => style.remove())
    throw error
  }
}
`
}

export function createElementPlusDocsCodeSandboxPayload(
  project: ElementPlusDocsExternalProject,
): ElementPlusDocsCodeSandboxPayload {
  const dependencies = resolveProjectDependencies(project)
  const styleImports = resolveProjectStyleImports(project)
  const source = project.files[sfcEntryPath]
  if (source === undefined)
    throw new Error(`CodeSandbox project is missing ${sfcEntryPath}`)

  const files = {
    'sandbox.config.json': '{"template":"static"}',
    'package.json': createCodeSandboxPackageJson(project, dependencies, styleImports),
    'index.html': codeSandboxHtml,
    [codeSandboxDemoPath]: createCodeSandboxDemoSource(source),
    [codeSandboxEntryPath]: createCodeSandboxEntry(),
    [codeSandboxRuntimePath]: createCodeSandboxRuntime(),
  }

  return {
    files: Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, {
        content,
        isBinary: false as const,
      }]),
    ),
  }
}

export function createElementPlusDocsCodeSandboxParameters(
  project: ElementPlusDocsExternalProject,
): string {
  const payload = createElementPlusDocsCodeSandboxPayload(project)
  return compressToBase64(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function openElementPlusDocsCodeSandbox(
  project: ElementPlusDocsExternalProject,
  options: ElementPlusDocsCodeSandboxOptions = {},
): void {
  const action = new URL(options.url ?? defaultCodeSandboxUrl)
  action.searchParams.set('query', options.query ?? `file=/${codeSandboxDemoPath}`)
  submitElementPlusDocsProjectForm(action.toString(), {
    parameters: createElementPlusDocsCodeSandboxParameters(project),
  })
}
