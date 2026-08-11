import type { ElementPlusDocsExternalProject } from './vue-project'
import { compressToBase64 } from 'lz-string'
import { submitElementPlusDocsProjectForm } from './submit-form'

const defaultCodeSandboxUrl = 'https://codesandbox.io/api/v1/sandboxes/define'
const codeSandboxConfigPath = 'sandbox.config.json'
const codeSandboxEntryPath = 'src/main.js'
const sharedEntryPath = 'src/main.ts'
const viteOnlyDependencies = new Set(['@vitejs/plugin-vue', 'vite'])
const typeScriptVersion = '^5.0.2'

const codeSandboxConfig = `${JSON.stringify({ template: 'vue-cli' }, null, 2)}\n`
const codeSandboxHtml = '<div style="margin: 16px;" id="app"></div>\n'

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

export function createElementPlusDocsCodeSandboxPayload(
  project: ElementPlusDocsExternalProject,
): ElementPlusDocsCodeSandboxPayload {
  // This follows Ant Design's dumi adapter: submit a compressed file map to the
  // Define API and select a browser template instead of creating a Devbox.
  const sourcePackageJson = JSON.parse(project.files['package.json']!) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const devDependencies = Object.fromEntries(
    Object.entries(sourcePackageJson.devDependencies ?? {})
      .filter(([name]) => !viteOnlyDependencies.has(name)),
  )
  if (/\blang\s*=\s*["']tsx?["']/.test(project.files['src/App.vue'] ?? ''))
    devDependencies.typescript ??= typeScriptVersion

  const packageJson = {
    name: project.title,
    description: project.description ?? 'An auto-generated demo by the documentation theme',
    main: codeSandboxEntryPath,
    dependencies: sourcePackageJson.dependencies ?? {},
    ...(Object.keys(devDependencies).length > 0 ? { devDependencies } : {}),
  }

  const files = {
    ...Object.fromEntries(
      Object.entries(project.files).filter(([path]) => (
        path !== 'index.html' && path !== 'vite.config.ts' && path !== sharedEntryPath
      )),
    ),
    'index.html': codeSandboxHtml,
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    [codeSandboxConfigPath]: codeSandboxConfig,
    [codeSandboxEntryPath]: project.files[sharedEntryPath],
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
  action.searchParams.set('query', options.query ?? 'file=/src/App.vue')
  submitElementPlusDocsProjectForm(action.toString(), {
    parameters: createElementPlusDocsCodeSandboxParameters(project),
  })
}
