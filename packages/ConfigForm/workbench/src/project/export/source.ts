import type {
  LowCodeComponentRegistry,
  LowCodeNode,
  LowCodePageModel,
} from '@moluoxixi/config-form-designer'
import type { ProjectPath, WorkspaceFile, WorkspaceProject } from '../types'
import { normalizeProjectPath } from '../path'
import { cloneWorkspaceProject } from '../revision'

/**
 * Files generated for the downloadable Source artifact.  The workbench
 * itself still uses ConfigForm for its runtime preview; this projection is a
 * deliberately standalone Vue project that can be installed outside the
 * monorepo without the ConfigForm packages.
 */
export interface PureSourceExport {
  project: WorkspaceProject
  files: Record<ProjectPath, WorkspaceFile>
}

interface PackageJson {
  [key: string]: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function textFile(content: string, language: string): WorkspaceFile {
  return { content, kind: 'text', language }
}

function materialName(component: string): string {
  return component.split('.').at(-1) ?? component
}

function quote(value: string): string {
  return JSON.stringify(value)
}

function escapeHtml(value: string): string {
  const entities = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    [String.fromCharCode(34), '&quot;'],
    [String.fromCharCode(39), '&#39;'],
  ])
  return value.replace(/[&<>'"]/g, character => entities.get(character)!)
}

function styleForNode(node: LowCodeNode, columns: number): string | undefined {
  if (node.kind !== 'field' || node.span === undefined)
    return undefined
  const span = Math.min(columns, Math.max(1, node.span))
  return `grid-column: span ${span} / span ${span}`
}

function htmlProps(node: LowCodeNode): Record<string, unknown> {
  const allowed = new Set(['accept', 'autocomplete', 'disabled', 'maxlength', 'min', 'max', 'pattern', 'placeholder', 'readonly', 'rows', 'step'])
  return Object.fromEntries(Object.entries(node.props).filter(([key]) => allowed.has(key)))
}

function fieldOptions(node: LowCodeNode): Array<{ label: string, value: unknown }> {
  const options = node.props.options
  if (!Array.isArray(options))
    return []
  return options.flatMap((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option))
      return []
    const record = option as Record<string, unknown>
    return typeof record.label === 'string' && Object.hasOwn(record, 'value')
      ? [{ label: record.label, value: record.value }]
      : []
  })
}

function inputType(node: LowCodeNode): string {
  switch (materialName(node.component)) {
    case 'input-number': return 'number'
    case 'date': return 'date'
    case 'time': return 'time'
    case 'password': return 'password'
    case 'search': return 'search'
    case 'checkbox':
    case 'switch': return 'checkbox'
    default: return 'text'
  }
}

function collectInitialValues(nodes: LowCodeNode[], values: Record<string, unknown>): void {
  for (const node of nodes) {
    if (node.kind === 'field' && node.field)
      values[node.field] = node.defaultValue ?? (inputType(node) === 'checkbox' ? false : '')
    collectInitialValues(node.children, values)
    Object.values(node.slots).forEach(children => collectInitialValues(children, values))
  }
}

function assertPortableNode(node: LowCodeNode, registry: LowCodeComponentRegistry): void {
  if (!registry.get(node.component))
    throw new Error(`Component "${node.component}" is not registered and cannot be exported.`)
  if (Object.keys(node.events).length || Object.keys(node.bindings).length || node.reactions?.length || node.conditions) {
    throw new Error(`Node "${node.id}" uses dynamic semantics that are not supported by standalone Source export.`)
  }
  node.children.forEach(child => assertPortableNode(child, registry))
  Object.values(node.slots).forEach(children => children.forEach(child => assertPortableNode(child, registry)))
}

function renderField(node: LowCodeNode, columns: number): string {
  const id = quote(node.id)
  const field = quote(node.field ?? node.id)
  const type = inputType(node)
  const style = styleForNode(node, columns)
  const attrs = ` v-bind='fieldProps[${id}]'`
  const styleAttr = style ? ` style="${style}"` : ''
  const safeId = escapeHtml(node.id)
  const label = node.label ? `\n      <label class="source-field-label" for="field-${safeId}">${escapeHtml(node.label)}</label>` : ''
  if (type === 'checkbox') {
    return `    <div class="source-field source-field-checkbox" data-node-id="${safeId}"${styleAttr}>\n      <label>${label ? escapeHtml(node.label ?? '') : ''}<input id="field-${safeId}" type="checkbox"${attrs} v-model='model[${field}]' /></label>\n    </div>`
  }
  if (materialName(node.component) === 'textarea') {
    return `    <div class="source-field" data-node-id="${safeId}"${styleAttr}>${label}\n      <textarea id="field-${safeId}"${attrs} v-model='model[${field}]'></textarea>\n    </div>`
  }
  if (materialName(node.component) === 'select' || materialName(node.component) === 'radio') {
    return `    <div class="source-field" data-node-id="${safeId}"${styleAttr}>${label}\n      <select id="field-${safeId}"${attrs} v-model='model[${field}]'>\n        <option v-for='option in fieldOptions[${id}]' :key="String(option.value)" :value="option.value">{{ option.label }}</option>\n      </select>\n    </div>`
  }
  return `    <div class="source-field" data-node-id="${safeId}"${styleAttr}>${label}\n      <input id="field-${safeId}" type="${type}"${attrs} v-model='model[${field}]' />\n    </div>`
}

function renderNodes(nodes: LowCodeNode[], columns: number, indent = 0): string {
  const rendered = nodes.map((node) => {
    if (node.kind === 'field')
      return renderField(node, columns)
    const slots = Object.entries(node.slots)
    const defaultChildren = node.children.length > 0 ? node.children : (node.slots.default ?? [])
    const slotMarkup = [
      ...(defaultChildren.length > 0 ? [`      <div class="source-slot" data-slot="default">\n${renderNodes(defaultChildren, columns, indent + 2)}\n      </div>`] : []),
      ...slots.filter(([name]) => name !== 'default').map(([name, children]) => `      <div class="source-slot" data-slot="${escapeHtml(name)}">\n${renderNodes(children, columns, indent + 2)}\n      </div>`),
    ]
    return `    <section class="source-layout" data-node-id="${escapeHtml(node.id)}" data-component="${escapeHtml(node.component)}">\n${slotMarkup.join('\n')}\n    </section>`
  })
  return rendered.join('\n')
}

function appSource(model: LowCodePageModel): string {
  const initialValues: Record<string, unknown> = {}
  collectInitialValues(model.nodes, initialValues)
  const props: Record<string, Record<string, unknown>> = {}
  const options: Record<string, Array<{ label: string, value: unknown }>> = {}
  const collectProps = (nodes: LowCodeNode[]): void => {
    nodes.forEach((node) => {
      if (node.kind === 'field') {
        props[node.id] = htmlProps(node)
        options[node.id] = fieldOptions(node)
      }
      collectProps(node.children)
      Object.values(node.slots).forEach(collectProps)
    })
  }
  collectProps(model.nodes)
  const columns = model.form.columns ?? 24
  return `<script setup lang="ts">
import { reactive, ref } from 'vue'

const model = reactive<Record<string, unknown>>(${JSON.stringify(initialValues, null, 2)})
const fieldProps = ${JSON.stringify(props, null, 2)} as Record<string, Record<string, unknown>>
const fieldOptions = ${JSON.stringify(options, null, 2)} as Record<string, Array<{ label: string, value: unknown }>>
const submitted = ref('')

function handleSubmit(): void {
  submitted.value = JSON.stringify(model, null, 2)
}
</script>

<template>
  <main class="source-page">
    <header class="source-header">
      <p class="source-kicker">Generated Vue page</p>
      <h1>${escapeHtml(model.name)}</h1>
      <p>Standalone source generated from the committed design model.</p>
    </header>
    <form class="source-form" @submit.prevent="handleSubmit">
      <div class="source-grid" style="grid-template-columns: repeat(${columns}, minmax(0, 1fr));">
${renderNodes(model.nodes, columns)}
      </div>
      <button class="source-submit" type="submit">Save</button>
    </form>
    <pre v-if="submitted" class="source-result" aria-live="polite">{{ submitted }}</pre>
  </main>
</template>
`
}

function sourceStyles(): string {
  return `:root { color: #18212b; background: #eef2f6; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
button, input, select, textarea { font: inherit; }
.source-page { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 64px; }
.source-header { margin-bottom: 28px; }
.source-kicker { margin: 0 0 8px; color: #2563eb; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.source-header h1 { margin: 0; font-size: 32px; }
.source-header p:last-child { color: #586574; }
.source-form { padding: 24px; border: 1px solid #d5dce5; border-radius: 8px; background: #fff; }
.source-grid { display: grid; gap: 16px; }
.source-field { min-width: 0; }
.source-field-label { display: block; margin-bottom: 6px; color: #3d4b59; font-size: 13px; }
.source-field input, .source-field select, .source-field textarea { width: 100%; min-height: 36px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; }
.source-field textarea { min-height: 84px; resize: vertical; }
.source-field-checkbox label { display: inline-flex; gap: 8px; align-items: center; min-height: 36px; }
.source-layout { min-width: 0; padding: 14px; border: 1px solid #d5dce5; border-radius: 7px; background: #f8fafc; }
.source-slot { display: grid; gap: 12px; min-width: 0; }
.source-submit { min-height: 38px; margin-top: 20px; padding: 0 16px; color: #fff; border: 0; border-radius: 5px; background: #1d4ed8; cursor: pointer; }
.source-result { margin-top: 20px; padding: 16px; overflow: auto; color: #d7f9e4; border-radius: 5px; background: #17212b; }
@media (max-width: 640px) { .source-page { width: min(100% - 20px, 920px); padding-top: 24px; } .source-form { padding: 16px; } .source-grid { grid-template-columns: 1fr !important; } .source-field { grid-column: 1 / -1 !important; } .source-header h1 { font-size: 26px; } }
`
}

function sourcePackage(project: WorkspaceProject): string {
  const packageFile = project.files[normalizeProjectPath('package.json')]
  const original = packageFile?.kind === 'text' ? JSON.parse(packageFile.content) as PackageJson : {}
  const dependencies = original.dependencies ?? {}
  const devDependencies = original.devDependencies ?? {}
  const manifest = {
    name: original.name ?? project.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    private: true,
    type: 'module',
    version: original.version ?? '0.0.0',
    packageManager: original.packageManager,
    scripts: {
      build: 'vue-tsc -p tsconfig.json --noEmit && vite build',
      dev: 'vite',
      typecheck: 'vue-tsc -p tsconfig.json --noEmit',
    },
    dependencies: { vue: dependencies.vue ?? '3.5.33' },
    devDependencies: {
      '@vitejs/plugin-vue': devDependencies['@vitejs/plugin-vue'] ?? '5.2.3',
      'typescript': devDependencies.typescript ?? '5.8.2',
      'vite': devDependencies.vite ?? '6.2.0',
      'vue-tsc': devDependencies['vue-tsc'] ?? '2.2.8',
    },
  }
  if (!manifest.packageManager)
    delete manifest.packageManager
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function createPureSourceExport(project: WorkspaceProject, model: LowCodePageModel, registry: LowCodeComponentRegistry): PureSourceExport {
  model.nodes.forEach(node => assertPortableNode(node, registry))
  const next = cloneWorkspaceProject(project)
  const files: Record<ProjectPath, WorkspaceFile> = {}
  for (const [path, file] of Object.entries(next.files) as Array<[ProjectPath, WorkspaceFile]>) {
    if (path === normalizeProjectPath('src/form.config.ts') || path === normalizeProjectPath('src/form.designer.json') || path === normalizeProjectPath('src/App.vue') || path === normalizeProjectPath('src/main.ts') || path === normalizeProjectPath('src/styles.css') || path === normalizeProjectPath('package.json'))
      continue
    files[path] = file
  }
  const modelPath = normalizeProjectPath('src/page.model.json')
  files[normalizeProjectPath('package.json')] = textFile(sourcePackage(project), 'json')
  files[normalizeProjectPath('src/App.vue')] = textFile(appSource(model), 'vue')
  files[normalizeProjectPath('src/main.ts')] = textFile(`import { createApp } from 'vue'\nimport App from './App.vue'\nimport './styles.css'\n\ncreateApp(App).mount('#app')\n`, 'typescript')
  files[normalizeProjectPath('src/styles.css')] = textFile(sourceStyles(), 'css')
  files[modelPath] = textFile(`${JSON.stringify(model, null, 2)}\n`, 'json')
  next.files = files
  next.manifest = {
    ...next.manifest,
    dependencies: JSON.parse((files[normalizeProjectPath('package.json')] as { content: string }).content).dependencies,
    designerArtifact: modelPath,
    generatedFormModule: modelPath,
  }
  return { files, project: next }
}
