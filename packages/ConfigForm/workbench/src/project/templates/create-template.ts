import type { DesignerDocument } from '@moluoxixi/config-form-designer'
import type { ProjectPath, WorkspaceAdapter, WorkspaceFile, WorkspaceProject } from '../types'
import type { WorkspaceTemplate, WorkspaceTemplateInput } from './types'
import {
  createLowCodeComponentRegistry,
  designerDocumentToConfigModel,
} from '@moluoxixi/config-form-designer'
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { formatLowCodePageConfig } from '../../workbench/config-codec'
import { WorkspaceProjectError } from '../errors'
import { assertUniqueProjectPaths, normalizeProjectPath, safeProjectSlug } from '../path'
import { parseWorkspaceProject } from '../schema'

const VERSIONS = Object.freeze({
  '@moluoxixi/config-form': '0.2.3',
  '@moluoxixi/config-form-antd-vue': '0.2.3',
  '@moluoxixi/config-form-element': '0.2.4',
  '@moluoxixi/config-form-headless': '0.2.4',
  '@vitejs/plugin-vue': '5.2.3',
  'ant-design-vue': '4.2.6',
  'element-plus': '2.9.1',
  'sass': '1.85.0',
  'typescript': '5.8.2',
  'vite': '6.2.0',
  'vue': '3.5.33',
  'vue-tsc': '2.2.8',
  'zod': '3.24.2',
})

const lowCodeRegistries = {
  'antd-vue': createLowCodeComponentRegistry(createAntdVueDesignerRegistry()),
  'element-plus': createLowCodeComponentRegistry(createElementPlusDesignerRegistry()),
}

interface TemplateDefinition {
  adapter: WorkspaceAdapter
  description: string
  id: string
  order: number
  title: string
}

function textFile(content: string, language?: string): WorkspaceFile {
  return { content, kind: 'text', ...(language ? { language } : {}) }
}

function packageManifest(adapter: WorkspaceAdapter, name: string): string {
  const adapterPackage = adapter === 'element-plus'
    ? '@moluoxixi/config-form-element'
    : '@moluoxixi/config-form-antd-vue'
  const uiPackage = adapter === 'element-plus' ? 'element-plus' : 'ant-design-vue'
  return `${JSON.stringify({
    name: safeProjectSlug(name),
    private: true,
    type: 'module',
    version: '0.0.0',
    packageManager: 'pnpm@10.29.3',
    scripts: {
      build: 'vue-tsc -p tsconfig.json --noEmit && vite build',
      dev: 'vite',
      typecheck: 'vue-tsc -p tsconfig.json --noEmit',
    },
    dependencies: {
      '@moluoxixi/config-form': VERSIONS['@moluoxixi/config-form'],
      '@moluoxixi/config-form-headless': VERSIONS['@moluoxixi/config-form-headless'],
      [adapterPackage]: VERSIONS[adapterPackage],
      [uiPackage]: VERSIONS[uiPackage],
      'vue': VERSIONS.vue,
      'zod': VERSIONS.zod,
    },
    devDependencies: {
      '@vitejs/plugin-vue': VERSIONS['@vitejs/plugin-vue'],
      'sass': VERSIONS.sass,
      'typescript': VERSIONS.typescript,
      'vite': VERSIONS.vite,
      'vue-tsc': VERSIONS['vue-tsc'],
    },
  }, null, 2)}\n`
}

function designerDocument(adapter: WorkspaceAdapter): DesignerDocument {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  return {
    version: 1,
    form: { columns: 24, fieldSpan: 24, gap: '16px', labelPosition: 'left' },
    nodes: [
      {
        id: 'profile-name',
        kind: 'field',
        material: `${prefix}.input`,
        field: 'name',
        label: 'Name',
        defaultValue: '',
        props: { placeholder: 'Enter your name' },
        span: 12,
      },
      {
        id: 'profile-role',
        kind: 'field',
        material: `${prefix}.select`,
        field: 'role',
        label: 'Role',
        defaultValue: 'developer',
        props: {
          options: [
            { label: 'Developer', value: 'developer' },
            { label: 'Designer', value: 'designer' },
          ],
          placeholder: 'Select a role',
        },
        span: 12,
      },
      {
        id: 'profile-active',
        kind: 'field',
        material: `${prefix}.switch`,
        field: 'active',
        label: 'Active',
        defaultValue: true,
        span: 24,
      },
    ],
  }
}

export function formatWorkspaceAppComponent(adapter: WorkspaceAdapter): string {
  const component = adapter === 'element-plus' ? 'ElementConfigForm' : 'AntdConfigForm'
  const packageName = adapter === 'element-plus'
    ? '@moluoxixi/config-form-element'
    : '@moluoxixi/config-form-antd-vue'
  return `<script setup lang="ts">
import { ${component} } from '${packageName}'
import { ref } from 'vue'
import { fields, form, initialValues } from './form.config'

const model = ref({ ...initialValues })
const submitted = ref('')

function handleSubmit(values: Record<string, unknown>) {
  submitted.value = JSON.stringify(values, null, 2)
}
</script>

<template>
  <main class="page-shell">
    <header class="page-header">
      <p class="page-kicker">ConfigForm</p>
      <h1>Profile settings</h1>
      <p>Update the generated form and submit it to inspect the live model.</p>
    </header>
    <section class="form-section" aria-labelledby="profile-form-title">
      <h2 id="profile-form-title">Account details</h2>
      <${component} v-model="model" v-bind="form" :fields="fields" @submit="handleSubmit">
        <button class="submit-button" type="submit">Save profile</button>
      </${component}>
    </section>
    <pre v-if="submitted" class="result" aria-live="polite">{{ submitted }}</pre>
  </main>
</template>
`
}

function mainModule(adapter: WorkspaceAdapter): string {
  const uiStyle = adapter === 'element-plus'
    ? `import 'element-plus/dist/index.css'\nimport '@moluoxixi/config-form-element/styles'`
    : `import 'ant-design-vue/dist/reset.css'\nimport '@moluoxixi/config-form-antd-vue/styles'`
  return `import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'
${uiStyle}

createApp(App).mount('#app')
`
}

const viteConfig = `import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue()],
})
`

const tsconfig = `${JSON.stringify({
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

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ConfigForm project</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`

const styles = `:root {
  color: #18212b;
  background: #eef2f6;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
button, input, select, textarea { font: inherit; }
.page-shell { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 64px; }
.page-header { margin-bottom: 32px; }
.page-kicker { margin: 0 0 8px; color: #2563eb; font-size: 12px; font-weight: 700; text-transform: uppercase; }
h1 { margin: 0; font-size: 32px; letter-spacing: 0; }
.page-header > p:last-child { max-width: 620px; color: #586574; }
.form-section { padding: 24px; border: 1px solid #d5dce5; border-radius: 6px; background: #fff; }
.form-section h2 { margin: 0 0 24px; font-size: 18px; }
.submit-button { min-height: 38px; margin-top: 8px; padding: 0 16px; color: #fff; border: 0; border-radius: 4px; background: #1d4ed8; cursor: pointer; }
.result { margin-top: 20px; padding: 16px; overflow: auto; color: #d7f9e4; border-radius: 4px; background: #17212b; }
@media (max-width: 640px) { .page-shell { width: min(100% - 20px, 920px); padding-top: 24px; } .form-section { padding: 16px; } h1 { font-size: 26px; } }
`

function createTemplateFiles(adapter: WorkspaceAdapter, id: string, name: string): Record<ProjectPath, WorkspaceFile> {
  const document = designerDocument(adapter)
  const model = designerDocumentToConfigModel(document, { id, name })
  const rawFiles: Record<string, WorkspaceFile> = {
    'index.html': textFile(html, 'html'),
    'package.json': textFile(packageManifest(adapter, name), 'json'),
    'src/App.vue': textFile(formatWorkspaceAppComponent(adapter), 'vue'),
    'src/form.designer.json': textFile(`${JSON.stringify(model, null, 2)}\n`, 'json'),
    'src/form.config.ts': textFile(formatLowCodePageConfig(model, lowCodeRegistries[adapter]), 'typescript'),
    'src/main.ts': textFile(mainModule(adapter), 'typescript'),
    'src/styles.css': textFile(styles, 'css'),
    'src/vite-env.d.ts': textFile('/// <reference types="vite/client" />\n', 'typescript'),
    'tsconfig.json': textFile(tsconfig, 'json'),
    'vite.config.ts': textFile(viteConfig, 'typescript'),
  }
  const paths = assertUniqueProjectPaths(Object.keys(rawFiles))
  return Object.fromEntries(paths.map((path, index) => [path, rawFiles[Object.keys(rawFiles)[index]!]]))
}

function createTemplate(definition: TemplateDefinition): WorkspaceTemplate {
  return {
    ...definition,
    version: 1,
    create(input: WorkspaceTemplateInput): WorkspaceProject {
      const files = createTemplateFiles(definition.adapter, input.id, input.name)
      const packageJson = JSON.parse((files[normalizeProjectPath('package.json')] as { content: string }).content) as {
        dependencies: Record<string, string>
      }
      return parseWorkspaceProject({
        createdAt: input.createdAt,
        files,
        id: input.id,
        manifest: {
          adapter: definition.adapter,
          dependencies: packageJson.dependencies,
          designerArtifact: normalizeProjectPath('src/form.designer.json'),
          entry: normalizeProjectPath('src/main.ts'),
          framework: 'vue',
          generatedFormModule: normalizeProjectPath('src/form.config.ts'),
        },
        name: input.name,
        revision: 1,
        schemaVersion: 1,
        template: { id: definition.id, version: 1 },
        updatedAt: input.createdAt,
      })
    },
  }
}

export const elementProfileTemplate = createTemplate({
  adapter: 'element-plus',
  description: 'Element Plus profile form with responsive ConfigForm fields.',
  id: 'element-profile',
  order: 10,
  title: 'Element Plus profile',
})

export const antdProfileTemplate = createTemplate({
  adapter: 'antd-vue',
  description: 'Ant Design Vue profile form with the same portable document.',
  id: 'antd-profile',
  order: 20,
  title: 'Ant Design Vue profile',
})

export function createWorkspaceTemplateRegistry(templates: WorkspaceTemplate[]): ReadonlyMap<string, WorkspaceTemplate> {
  const registry = new Map<string, WorkspaceTemplate>()
  for (const template of [...templates].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))) {
    if (!/^[a-z][a-z0-9-]*$/.test(template.id))
      throw new WorkspaceProjectError('TEMPLATE_INVALID', `[config-form-workbench] invalid template id "${template.id}"`)
    if (registry.has(template.id))
      throw new WorkspaceProjectError('TEMPLATE_DUPLICATE', `[config-form-workbench] template "${template.id}" already exists`)
    registry.set(template.id, template)
  }
  return registry
}
