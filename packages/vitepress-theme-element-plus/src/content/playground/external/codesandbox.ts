import type { ElementPlusDocsExternalProject } from './vue-project'
import { compressToBase64 } from 'lz-string'
import { submitElementPlusDocsProjectForm } from './submit-form'

const defaultCodeSandboxUrl = 'https://codesandbox.io/api/v1/sandboxes/define'

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
  return {
    files: Object.fromEntries(
      Object.entries(project.files).map(([path, content]) => [path, {
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
