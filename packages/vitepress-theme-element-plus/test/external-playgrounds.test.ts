// @vitest-environment happy-dom
import { decompressFromBase64 } from 'lz-string'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createElementPlusDocsCodeSandboxParameters,
  createElementPlusDocsCodeSandboxPayload,
  createElementPlusDocsExternalProject,
  createElementPlusDocsStackBlitzProject,
  openElementPlusDocsCodeSandbox,
  openElementPlusDocsStackBlitz,
} from '../index'

const source = '<script setup lang="ts">const count = 1</script><template>{{ count }}</template>'

function createProject() {
  return createElementPlusDocsExternalProject(source, {
    dependencies: {
      '@example/components': '^1.2.3',
      'element-plus': '^2.9.0',
    },
    description: 'Editable documentation example',
    packageName: 'example-components-demo',
    styleImports: ['element-plus/dist/index.css', '@example/components/styles'],
    title: 'Example Components Demo',
  })
}

function decodeCodeSandboxParameters(parameters: string): unknown {
  const base64 = parameters.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return JSON.parse(decompressFromBase64(padded))
}

function captureSubmittedForm() {
  let submittedForm: HTMLFormElement | undefined
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
    submittedForm = this.cloneNode(true) as HTMLFormElement
  })
  return {
    get form() {
      if (!submittedForm)
        throw new Error('Expected a project form to be submitted')
      return submittedForm
    },
    submit,
  }
}

function formFields(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...form.querySelectorAll<HTMLInputElement>('input')].map(input => [input.name, input.value]),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('external playground projects', () => {
  it('creates a complete Vue and Vite project from the selected demo source', () => {
    const project = createProject()
    const packageJson = JSON.parse(project.files['package.json']!)

    expect(project.files['src/App.vue']).toBe(source)
    expect(project.files).toHaveProperty('index.html')
    expect(project.files).toHaveProperty('vite.config.ts')
    expect(project.files['src/main.ts']).toContain('element-plus/dist/index.css')
    expect(project.files['src/main.ts']).toContain('@example/components/styles')
    expect(packageJson.dependencies).toMatchObject({
      '@example/components': '^1.2.3',
      'element-plus': '^2.9.0',
      'vue': '^3.5.0',
    })
    expect(packageJson.devDependencies).toMatchObject({
      '@vitejs/plugin-vue': '^5.2.0',
      'vite': '^6.0.0',
    })
  })

  it('submits the official StackBlitz node project POST protocol', () => {
    const project = createProject()
    const stackBlitzProject = createElementPlusDocsStackBlitzProject(project)
    const capture = captureSubmittedForm()

    openElementPlusDocsStackBlitz(project, { theme: 'dark', view: 'editor' })

    const action = new URL(capture.form.action)
    const fields = formFields(capture.form)
    expect(stackBlitzProject.template).toBe('node')
    expect(action.origin).toBe('https://stackblitz.com')
    expect(action.pathname).toBe('/run')
    expect(action.searchParams.get('file')).toBe('src/App.vue')
    expect(action.searchParams.get('startScript')).toBe('dev')
    expect(action.searchParams.get('theme')).toBe('dark')
    expect(fields['project[template]']).toBe('node')
    expect(fields['project[files][src/App.vue]']).toBe(source)
    expect(capture.form.method).toBe('POST')
    expect(capture.form.target).toBe('_blank')
  })

  it('submits a CodeSandbox Define API payload that round-trips every project file', () => {
    const project = createProject()
    const payload = createElementPlusDocsCodeSandboxPayload(project)
    const parameters = createElementPlusDocsCodeSandboxParameters(project)
    const capture = captureSubmittedForm()

    openElementPlusDocsCodeSandbox(project)

    const action = new URL(capture.form.action)
    const fields = formFields(capture.form)
    expect(action.origin).toBe('https://codesandbox.io')
    expect(action.pathname).toBe('/api/v1/sandboxes/define')
    expect(action.searchParams.get('query')).toBe('file=/src/App.vue')
    expect(payload.files['src/App.vue']).toEqual({ content: source, isBinary: false })
    expect(decodeCodeSandboxParameters(parameters)).toEqual(payload)
    expect(fields.parameters).toBe(parameters)
    expect(capture.form.method).toBe('POST')
    expect(capture.form.target).toBe('_blank')
  })
})
