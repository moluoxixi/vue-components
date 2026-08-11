import type { ElementPlusDocsExternalProject } from './vue-project'
import { compressToBase64 } from 'lz-string'
import { submitElementPlusDocsProjectForm } from './submit-form'

const defaultCodeSandboxUrl = 'https://codesandbox.io/api/v1/sandboxes/define'
const codeSandboxTasksPath = '.codesandbox/tasks.json'

const codeSandboxTasks = {
  setupTasks: [
    {
      name: 'Install Dependencies',
      command: 'npm install',
    },
  ],
  tasks: {
    start: {
      name: 'Vite Dev',
      command: 'npm run start',
      runAtStart: true,
      preview: {
        port: 5173,
      },
    },
  },
}

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
  const files = {
    ...project.files,
    [codeSandboxTasksPath]: `${JSON.stringify(codeSandboxTasks, null, 2)}\n`,
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
    environment: 'server',
    parameters: createElementPlusDocsCodeSandboxParameters(project),
  })
}
