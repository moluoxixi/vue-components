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

const source = `<script setup lang="ts">
const count = 1
const label = \`value: \${count}\\docs\`
</script>

<template>
  <p>{{ label }}</p>
</template>`

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

function evaluateCodeSandboxDemoSource(moduleSource: string): string {
  const prefix = 'export default `'
  const suffix = '`\n'
  if (!moduleSource.startsWith(prefix) || !moduleSource.endsWith(suffix))
    throw new Error('Unexpected CodeSandbox demo module shape')

  const templateSource = moduleSource.slice(prefix.length, -suffix.length)
  let source = ''
  for (let index = 0; index < templateSource.length; index += 1) {
    const character = templateSource[index]!
    if (character !== '\\') {
      source += character
      continue
    }

    const escaped = templateSource[index + 1]
    if (escaped === '\\' || escaped === '`') {
      source += escaped
      index += 1
      continue
    }
    if (escaped === '$' && templateSource[index + 2] === '{') {
      source += '${'
      index += 2
      continue
    }
    throw new Error(`Unexpected CodeSandbox demo escape at index ${index}`)
  }
  return source
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
    expect(project.dependencies).toEqual({
      '@example/components': '^1.2.3',
      'element-plus': '^2.9.0',
      'vue': '^3.5.0',
    })
    expect(project.styleImports).toEqual([
      'element-plus/dist/index.css',
      '@example/components/styles',
    ])
    expect(project.files).not.toHaveProperty('.codesandbox/tasks.json')
    expect(project.files).not.toHaveProperty('sandbox.config.json')
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
    expect(packageJson.scripts).toEqual({
      start: 'vite --host 0.0.0.0',
    })
  })

  it('merges dependency metadata that was resolved at documentation build time', () => {
    const project = createElementPlusDocsExternalProject(
      source,
      {
        title: 'Resolved Demo',
      },
      {
        dependencies: {
          '@example/components': '^1.2.3',
          'element-plus': '^2.9.0',
        },
        source: source.replace('const count = 1', 'import { CopyText } from \'@example/components/CopyText\''),
        styleImports: ['@example/components/styles', 'element-plus/dist/index.css'],
      },
    )
    const packageJson = JSON.parse(project.files['package.json']!)

    expect(project.files['src/App.vue']).toContain('@example/components/CopyText')
    expect(project.files['src/main.ts']).toContain('@example/components/styles')
    expect(packageJson.dependencies).toEqual({
      '@example/components': '^1.2.3',
      'element-plus': '^2.9.0',
      'vue': '^3.5.0',
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
    expect(action.searchParams.get('startScript')).toBe('start')
    expect(action.searchParams.get('theme')).toBe('dark')
    expect(fields['project[template]']).toBe('node')
    expect(fields['project[files][src/App.vue]']).toBe(source)
    expect(capture.form.method).toBe('POST')
    expect(capture.form.target).toBe('_blank')
  })

  it('submits a pure static CodeSandbox payload with a browser SFC runtime', () => {
    const project = createProject()
    const payload = createElementPlusDocsCodeSandboxPayload(project)
    const parameters = createElementPlusDocsCodeSandboxParameters(project)
    const capture = captureSubmittedForm()

    openElementPlusDocsCodeSandbox(project)

    const action = new URL(capture.form.action)
    const fields = formFields(capture.form)
    expect(action.origin).toBe('https://codesandbox.io')
    expect(action.pathname).toBe('/api/v1/sandboxes/define')
    expect(action.searchParams.get('query')).toBe('file=/demo.js')
    expect(Object.keys(payload.files).sort()).toEqual([
      'demo.js',
      'index.html',
      'load-module.js',
      'main.js',
      'package.json',
      'sandbox.config.json',
    ])
    expect(payload.files['demo.js']!.content).toContain('export default `<script setup lang="ts">')
    expect(payload.files['demo.js']!.content).toContain('\n\n<template>')
    expect(evaluateCodeSandboxDemoSource(payload.files['demo.js']!.content)).toBe(source)
    expect(payload.files).not.toHaveProperty('vite.config.ts')
    expect(payload.files).not.toHaveProperty('src/main.ts')
    expect(payload.files).not.toHaveProperty('src/App.vue')
    expect(payload.files['sandbox.config.json']).toEqual({
      content: '{"template":"static"}',
      isBinary: false,
    })
    expect(payload.files['index.html']!.content).toContain('id="app"')
    expect(payload.files['index.html']!.content).toContain('src="./main.js"')
    expect(payload.files['index.html']!.content).not.toContain('/src/main.ts')
    expect(payload.files['main.js']!.content).toContain('import demoSource from \'./demo.js\'')
    expect(payload.files['main.js']!.content).toContain('import { mountDemo } from \'./load-module.js\'')
    expect(payload.files['main.js']!.content).toContain('fetch(new URL(\'./package.json\', import.meta.url))')
    expect(payload.files['main.js']!.content).toContain('await mountDemo({')
    expect(payload.files['main.js']!.content).not.toContain('vue3-sfc-loader')
    expect(payload.files['load-module.js']!.content).toContain('vue3-sfc-loader@0.9.5')
    expect(payload.files['load-module.js']!.content).toContain('const virtualEntryPath = "/__mx_docs_sfc__/demo.vue"')
    expect(payload.files['load-module.js']!.content).toContain('loadModule(virtualEntryPath')
    expect(payload.files['load-module.js']!.content).toContain('getContentData: () => demoSource')
    expect(payload.files['load-module.js']!.content).toContain('\'/+esm\'')
    expect(JSON.parse(payload.files['package.json']!.content)).toEqual({
      name: 'example-components-demo',
      private: true,
      description: 'Editable documentation example',
      dependencies: {
        '@example/components': '^1.2.3',
        'element-plus': '^2.9.0',
        'vue': '^3.5.0',
      },
      elementPlusDocs: {
        styleImports: [
          'element-plus/dist/index.css',
          '@example/components/styles',
        ],
      },
    })
    expect(project.files).toHaveProperty('vite.config.ts')
    expect(JSON.parse(project.files['package.json']!).scripts).toEqual({
      start: 'vite --host 0.0.0.0',
    })
    expect(decodeCodeSandboxParameters(parameters)).toEqual(payload)
    expect(fields).not.toHaveProperty('environment')
    expect(fields.parameters).toBe(parameters)
    expect(capture.form.method).toBe('POST')
    expect(capture.form.target).toBe('_blank')
  })
})
