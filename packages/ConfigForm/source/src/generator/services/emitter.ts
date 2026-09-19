import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  DatasetProjection,
  ModelJsonObject,
  ModelJsonValue,
  ProjectDataset,
  ProjectTheme,
} from '@moluoxixi/config-form-model'
import type {
  ConfigBindingFileSetV1,
  RawSourceFileSetV1,
  SourceBinaryFile,
  SourceComponentResolution,
  SourceConfigFormBindingResolution,
  SourceFile,
  SourceLanguage,
  SourceTextFile,
} from '../types'
import { readSourceFileSet } from '../validation'
import type { CollectedSourceResources } from './resources'
import {
  escapeHtml,
  kebabCase,
  safeSlug,
  sourceAttributeJson,
  sourceAttributeString,
  sourceJson,
  sourceString,
  sortedRecord,
  uniqueSlugs,
} from './serialization'

interface EmitContext {
  compilation: ProjectCompilation
  components: ReadonlyMap<string, SourceComponentResolution>
  resources: CollectedSourceResources
  surfaceDirectories: ReadonlyMap<string, string>
}

interface BindingEmitContext extends EmitContext {
  binding: SourceConfigFormBindingResolution
}

interface ExpressionProperty {
  key: string
  expression: string
}

type SourceSurface = ProjectCompilation['ir']['surfacesById'][string]
type SourceNode = SourceSurface['nodesById'][string]
type SourceFieldNode = Extract<SourceNode, { kind: 'field' }>

function textFile(path: string, language: SourceLanguage, content: string): SourceTextFile {
  return { kind: 'text', path, language, content: content.endsWith('\n') ? content : `${content}\n` }
}

function projectSlug(name: string): string {
  return safeSlug(name, 'config-form-demo')
}

function packageManifest(name: string, dependencies: Readonly<Record<string, string>>): string {
  return `${sourceJson({
    name: projectSlug(name),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      build: 'vue-tsc -p tsconfig.json --noEmit && vite build',
      dev: 'vite',
      typecheck: 'vue-tsc -p tsconfig.json --noEmit',
    },
    dependencies: sortedRecord({
      vue: '3.5.33',
      'vue-router': '^4.6.4',
      ...dependencies,
    }),
    devDependencies: {
      '@vitejs/plugin-vue': '6.0.4',
      typescript: '5.8.2',
      vite: '7.3.1',
      'vue-tsc': '2.2.8',
    },
  })}\n`
}

const viteConfig = `import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue()],
})
`

const tsconfig = `${sourceJson({
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
    noEmit: true,
    types: ['vite/client'],
  },
  include: ['src/**/*.ts', 'src/**/*.vue'],
})}\n`

function htmlSource(title: string): string {
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

function getPath(row: ModelJsonObject, path: readonly string[]): ModelJsonValue | undefined {
  let current: ModelJsonValue | undefined = row
  for (const segment of path) {
    if (current === null || typeof current !== 'object' || Array.isArray(current))
      return undefined
    current = current[segment]
  }
  return current
}

function projectDataset(dataset: ProjectDataset, projection: DatasetProjection): ModelJsonValue[] {
  if (projection.kind === 'options') {
    return dataset.rows.map((row) => {
      const disabled = projection.disabledPath ? getPath(row, projection.disabledPath) : undefined
      return {
        label: String(getPath(row, projection.labelPath) ?? ''),
        value: getPath(row, projection.valuePath) ?? null,
        ...(typeof disabled === 'boolean' ? { disabled } : {}),
      }
    })
  }
  if (projection.kind === 'table') {
    return dataset.rows.map(row => ({
      rowKey: getPath(row, projection.rowKeyPath) ?? null,
      ...Object.fromEntries(projection.columns.map(column => [column.key, getPath(row, column.valuePath) ?? null])),
    }))
  }
  return dataset.rows.map(row => ({
    itemKey: getPath(row, projection.itemKeyPath) ?? null,
    ...(projection.titlePath ? { title: getPath(row, projection.titlePath) ?? null } : {}),
    ...(projection.descriptionPath ? { description: getPath(row, projection.descriptionPath) ?? null } : {}),
  }))
}

function datasetViewKey(surfaceId: string, nodeId: string, bindingKey: string): string {
  return `${surfaceId}/${nodeId}/${bindingKey}`
}

function datasetsSource(compilation: ProjectCompilation): string {
  const datasets = Object.fromEntries(compilation.ir.datasetOrder.map((datasetId) => {
    const dataset = compilation.ir.datasetsById[datasetId]
    return [datasetId, dataset?.rows ?? []]
  }))
  const views: Record<string, ModelJsonValue[]> = {}
  for (const surfaceId of compilation.ir.surfaceOrder) {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      continue
    for (const nodeId of Object.keys(surface.nodesById).sort()) {
      const node = surface.nodesById[nodeId]
      if (!node?.datasetBindings)
        continue
      for (const [bindingKey, reference] of Object.entries(node.datasetBindings).sort(([left], [right]) => left.localeCompare(right))) {
        const dataset = compilation.ir.datasetsById[reference.datasetId]
        if (dataset)
          views[datasetViewKey(surfaceId, nodeId, bindingKey)] = projectDataset(dataset as ProjectDataset, reference.projection as DatasetProjection)
      }
    }
  }
  return `export const datasets = ${sourceJson(datasets as ModelJsonValue)} as const

export const datasetViews = ${sourceJson(views as ModelJsonValue)} as const
`
}

function resourcesSource(resources: CollectedSourceResources): string {
  const lines = [...resources.values]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resourceId, resource]) => resource.kind === 'url'
      ? `  ${sourceString(resourceId)}: ${sourceString(resource.url)},`
      : `  ${sourceString(resourceId)}: new URL(${sourceString(`../assets/${resource.fileName}`)}, import.meta.url).href,`)
  return `export const resources = {
${lines.join('\n')}
} as const
`
}

function themeSource(theme: ProjectTheme): string {
  const lines = [':root {']
  for (const [key, value] of Object.entries(theme.colors ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-color-${kebabCase(key)}: ${value};`)
  for (const [key, value] of Object.entries(theme.spacing ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-spacing-${key}: ${value}px;`)
  for (const [key, value] of Object.entries(theme.radius ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    lines.push(`  --demo-radius-${key}: ${value}px;`)
  if (theme.typography?.baseSize !== undefined)
    lines.push(`  --demo-font-size: ${theme.typography.baseSize}px;`)
  if (theme.typography?.lineHeight !== undefined)
    lines.push(`  --demo-line-height: ${theme.typography.lineHeight};`)
  lines.push('}')
  return `${lines.join('\n')}\n`
}

const projectStyles = `@import './theme.css';

* { box-sizing: border-box; }
html { color: var(--demo-color-text, #1f2937); background: var(--demo-color-canvas, #f4f6f8); font-family: system-ui, sans-serif; }
body { min-width: 320px; margin: 0; }
button, input, select, textarea { font: inherit; }
.demo-surface { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
.demo-surface__header { margin-bottom: 24px; }
.demo-surface__header h1 { margin: 0; font-size: 28px; }
.demo-surface__content { display: grid; gap: var(--demo-spacing-md, 16px); }
.demo-field { display: grid; gap: 6px; }
.demo-field__label { font-size: 13px; font-weight: 600; }
@media (max-width: 640px) { .demo-surface { width: min(100% - 20px, 960px); padding-top: 20px; } }
`

function componentForNode(
  node: SourceNode,
  components: ReadonlyMap<string, SourceComponentResolution>,
): SourceComponentResolution {
  const component = components.get(node.component)
  if (!component)
    throw new Error(`Missing resolved component: ${node.component}`)
  return component
}

function layoutStyle(node: SourceNode, resolution: SourceComponentResolution): ModelJsonObject | undefined {
  if (node.kind !== 'layout')
    return undefined
  const gap = typeof node.props.gap === 'number' && Number.isFinite(node.props.gap) ? Math.max(0, node.props.gap) : 0
  if (resolution.render === 'layout-flex') {
    return {
      display: 'flex',
      flexDirection: node.props.direction === 'column' ? 'column' : 'row',
      flexWrap: node.props.wrap === false ? 'nowrap' : 'wrap',
      gap: `${gap}px`,
      alignItems: typeof node.props.align === 'string' ? node.props.align : 'stretch',
      justifyContent: typeof node.props.justify === 'string' ? node.props.justify : 'flex-start',
    }
  }
  if (resolution.render === 'layout-grid') {
    const columns = typeof node.props.columns === 'number' && Number.isInteger(node.props.columns)
      ? Math.min(12, Math.max(1, node.props.columns))
      : 1
    return { display: 'grid', gap: `${gap}px`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
  }
  return undefined
}

function nodeProperties(
  surface: SourceSurface,
  node: SourceNode,
  resolution: SourceComponentResolution,
): ExpressionProperty[] {
  const values = new Map<string, string>()
  for (const [key, value] of Object.entries(resolution.staticProps ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, sourceAttributeJson(value))
  for (const [key, value] of Object.entries(node.props).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, sourceAttributeJson(value))
  const style = layoutStyle(node, resolution)
  if (style)
    values.set('style', sourceAttributeJson(style))
  for (const [key, reference] of Object.entries(node.datasetBindings ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, `datasetViews[${sourceAttributeString(datasetViewKey(surface.id, node.id, key))}]`)
  for (const [key, reference] of Object.entries(node.resourceBindings ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, `resources[${sourceAttributeString(reference.resourceId)}]`)
  if (node.kind === 'field' && resolution.valueProp)
    values.set(resolution.valueProp, `values[${sourceAttributeString(node.field)}]`)
  return [...values].map(([key, expression]) => ({ key, expression }))
}

function bindExpression(properties: readonly ExpressionProperty[]): string {
  if (properties.length === 0)
    return ''
  const expression = `{ ${properties.map(item => `${sourceAttributeString(item.key)}: ${item.expression}`).join(', ')} }`
  return ` v-bind="${expression}"`
}

function renderTag(resolution: SourceComponentResolution): string {
  return !resolution.library && resolution.moduleSpecifier ? resolution.importName : resolution.tag
}

function optionChildren(
  surface: SourceSurface,
  node: SourceNode,
  resolution: SourceComponentResolution,
  indent: string,
): string[] {
  if (resolution.options?.mode !== 'children' || !resolution.options.optionTag || !node.datasetBindings)
    return []
  const binding = Object.entries(node.datasetBindings).sort(([left], [right]) => left.localeCompare(right))[0]
  if (!binding)
    return []
  const [bindingKey] = binding
  const labelProp = resolution.options.labelProp ?? 'label'
  const valueProp = resolution.options.valueProp ?? 'value'
  return [
    `${indent}<${resolution.options.optionTag}`,
    `${indent}  v-for="(option, optionIndex) in datasetViews[${sourceAttributeString(datasetViewKey(surface.id, node.id, bindingKey))}]"`,
    `${indent}  :key="String(option.value) + '-' + optionIndex"`,
    `${indent}  :${kebabCase(labelProp)}="option.label"`,
    `${indent}  :${kebabCase(valueProp)}="option.value"`,
    `${indent}/>` ,
  ]
}

function renderRawNode(
  surface: SourceSurface,
  nodeId: string,
  context: EmitContext,
  depth: number,
): string[] {
  const node = surface.nodesById[nodeId]
  if (!node)
    return []
  const resolution = componentForNode(node, context.components)
  const tag = renderTag(resolution)
  const indent = '  '.repeat(depth)
  const attributes = [
    ` data-node-id="${escapeHtml(node.id)}"`,
    bindExpression(nodeProperties(surface, node, resolution)),
  ]
  if (node.kind === 'field' && resolution.trigger) {
    attributes.push(` @${kebabCase(resolution.trigger)}="updateValue(${sourceAttributeString(node.field)}, $event)"`)
  }
  const children: string[] = []
  if (node.kind === 'layout') {
    for (const [slot, childIds] of Object.entries(node.slots).sort(([left], [right]) => left.localeCompare(right))) {
      if (slot === 'default') {
        for (const childId of childIds)
          children.push(...renderRawNode(surface, childId, context, depth + 1))
      }
      else {
        children.push(`${indent}  <template #${slot}>`)
        for (const childId of childIds)
          children.push(...renderRawNode(surface, childId, context, depth + 2))
        children.push(`${indent}  </template>`)
      }
    }
  }
  children.push(...optionChildren(surface, node, resolution, `${indent}  `))
  if (node.kind === 'element' && typeof node.props.text === 'string')
    children.push(`${indent}  ${escapeHtml(node.props.text)}`)

  const componentLines = children.length === 0
    ? [`${indent}<${tag}${attributes.join('')} />`]
    : [`${indent}<${tag}${attributes.join('')}>`, ...children, `${indent}</${tag}>`]
  if (node.kind !== 'field')
    return componentLines
  return [
    `${indent}<div class="demo-field">`,
    ...(node.label ? [`${indent}  <span class="demo-field__label">${escapeHtml(node.label)}</span>`] : []),
    ...componentLines.map(line => `  ${line}`),
    `${indent}</div>`,
  ]
}

function surfaceUses(surface: SourceSurface, key: 'datasetBindings' | 'resourceBindings'): boolean {
  return Object.values(surface.nodesById).some(node => Object.keys(node[key] ?? {}).length > 0)
}

function rawSurfaceSource(surface: SourceSurface, context: EmitContext): string {
  const fields = Object.values(surface.nodesById)
    .filter((node): node is SourceFieldNode => node.kind === 'field')
    .sort((left, right) => left.id.localeCompare(right.id))
  const initialValues = Object.fromEntries(fields.map((node) => {
    const resolution = componentForNode(node, context.components)
    return [node.field, node.defaultValue ?? resolution.defaultValue ?? null]
  }))
  const namedImports = new Map<string, Set<string>>()
  for (const node of Object.values(surface.nodesById)) {
    const resolution = componentForNode(node, context.components)
    if (!resolution.library && resolution.moduleSpecifier) {
      const imports = namedImports.get(resolution.moduleSpecifier) ?? new Set<string>()
      imports.add(resolution.importName)
      namedImports.set(resolution.moduleSpecifier, imports)
    }
  }
  const imports = [
    ...(fields.length > 0 ? ["import { reactive } from 'vue'"] : []),
    ...[...namedImports].sort(([left], [right]) => left.localeCompare(right)).map(([moduleSpecifier, names]) => (
      `import { ${[...names].sort().join(', ')} } from ${sourceString(moduleSpecifier)}`
    )),
    ...(surfaceUses(surface, 'datasetBindings') ? ["import { datasetViews } from '../../data/datasets'"] : []),
    ...(surfaceUses(surface, 'resourceBindings') ? ["import { resources } from '../../data/resources'"] : []),
  ]
  const script = fields.length === 0
    ? imports.join('\n')
    : `${imports.join('\n')}

const values = reactive<Record<string, unknown>>(${sourceJson(initialValues)})

function updateValue(field: string, payload: unknown): void {
  const target = payload && typeof payload === 'object' && 'target' in payload
    ? (payload as { target?: { checked?: unknown, value?: unknown, type?: unknown } }).target
    : undefined
  values[field] = target?.type === 'checkbox' ? Boolean(target.checked) : (target?.value ?? payload)
}`
  const body = surface.rootIds.flatMap(nodeId => renderRawNode(surface, nodeId, context, 3))
  return `<script setup lang="ts">
${script}
</script>

<template>
  <section class="demo-surface" data-surface-id="${escapeHtml(surface.id)}" data-surface-kind="${surface.kind}">
    <header class="demo-surface__header">
      <h1>${escapeHtml(surface.name)}</h1>
    </header>
    <div class="demo-surface__content">
${body.join('\n')}
    </div>
  </section>
</template>
`
}

function fieldRequired(node: SourceFieldNode): { required?: boolean, message?: string } {
  const required = node.validation?.rules.find(rule => rule.kind === 'required')
  return required
    ? { required: true, ...('message' in required && typeof required.message === 'string' ? { message: required.message } : {}) }
    : {}
}

function configNodeSource(
  surface: SourceSurface,
  nodeId: string,
  context: BindingEmitContext,
  depth: number,
): string {
  const node = surface.nodesById[nodeId]
  if (!node)
    throw new Error(`Missing compiled node: ${nodeId}`)
  const resolution = componentForNode(node, context.components)
  const indent = '  '.repeat(depth)
  const childIndent = '  '.repeat(depth + 1)
  const lines = [
    `${indent}{`,
    `${childIndent}id: ${sourceString(node.id)},`,
    `${childIndent}component: ${sourceString(resolution.configComponent)},`,
  ]
  const properties = nodeProperties(surface, node, resolution)
    .filter(property => !(node.kind === 'field' && property.key === resolution.valueProp))
  if (properties.length > 0) {
    lines.push(`${childIndent}props: {`)
    for (const property of properties)
      lines.push(`${childIndent}  ${sourceString(property.key)}: ${property.expression},`)
    lines.push(`${childIndent}},`)
  }
  const span = node.placement.props.span
  if (typeof span === 'number')
    lines.push(`${childIndent}span: ${span},`)
  if (node.kind === 'field') {
    const required = fieldRequired(node)
    lines.push(`${childIndent}field: ${sourceString(node.field)},`)
    if (node.label !== undefined)
      lines.push(`${childIndent}label: ${sourceString(node.label)},`)
    if (node.defaultValue !== undefined)
      lines.push(`${childIndent}defaultValue: ${sourceJson(node.defaultValue)},`)
    if (node.validateOn.length > 0)
      lines.push(`${childIndent}validateOn: ${sourceJson(node.validateOn as unknown as ModelJsonValue)},`)
    if (required.required)
      lines.push(`${childIndent}required: true,`)
    if (required.message)
      lines.push(`${childIndent}requiredMessage: ${sourceString(required.message)},`)
    if (resolution.valueProp)
      lines.push(`${childIndent}valueProp: ${sourceString(resolution.valueProp)},`)
    if (resolution.trigger)
      lines.push(`${childIndent}trigger: ${sourceString(resolution.trigger)},`)
    if (resolution.blurTrigger)
      lines.push(`${childIndent}blurTrigger: ${sourceString(resolution.blurTrigger)},`)
  }
  if (node.kind === 'layout') {
    lines.push(`${childIndent}slots: {`)
    for (const [slot, children] of Object.entries(node.slots).sort(([left], [right]) => left.localeCompare(right))) {
      lines.push(`${childIndent}  ${sourceString(slot)}: [`)
      for (const childId of children)
        lines.push(configNodeSource(surface, childId, context, depth + 3))
      lines.push(`${childIndent}  ],`)
    }
    lines.push(`${childIndent}},`)
  }
  lines.push(`${indent}},`)
  return lines.join('\n')
}

function surfaceInitialModel(surface: SourceSurface, context: EmitContext): Record<string, unknown> {
  return Object.fromEntries(Object.values(surface.nodesById)
    .filter((node): node is SourceFieldNode => node.kind === 'field')
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => {
      const resolution = componentForNode(node, context.components)
      return [node.field, node.defaultValue ?? resolution.defaultValue ?? null]
    }))
}

function bindingConfigSource(surface: SourceSurface, context: BindingEmitContext): string {
  const imports = [
    ...(surfaceUses(surface, 'datasetBindings') ? ["import { datasetViews } from '../../data/datasets'"] : []),
    ...(surfaceUses(surface, 'resourceBindings') ? ["import { resources } from '../../data/resources'"] : []),
  ]
  const validationRules = Object.fromEntries(Object.values(surface.nodesById)
    .filter((node): node is SourceFieldNode & { validation: NonNullable<SourceFieldNode['validation']> } => node.kind === 'field' && node.validation !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(node => [node.id, node.validation!]))
  return `${imports.join('\n')}${imports.length ? '\n\n' : ''}export const initialModel = ${sourceJson(surfaceInitialModel(surface, context))}

export const fields = [
${surface.rootIds.map(nodeId => configNodeSource(surface, nodeId, context, 1)).join('\n')}
]

export const formConfig = ${sourceJson(surface.form)}

export const validationRulesByNodeId = ${sourceJson(validationRules)} as const
`
}

function bindingSurfaceSource(surface: SourceSurface, binding: SourceConfigFormBindingResolution): string {
  return `<script setup lang="ts">
import { shallowRef } from 'vue'
import { ${binding.component.importName} } from ${sourceString(binding.component.moduleSpecifier)}
import { ${binding.model.importName} } from ${sourceString(binding.model.moduleSpecifier)}
import { fields, formConfig, initialModel } from './config'

const values = shallowRef(structuredClone(initialModel))
const model = ${binding.model.importName}(values)
</script>

<template>
  <section class="demo-surface" data-surface-id="${escapeHtml(surface.id)}" data-surface-kind="${surface.kind}">
    <header class="demo-surface__header">
      <h1>${escapeHtml(surface.name)}</h1>
    </header>
    <${binding.component.importName}
      v-bind="formConfig"
      :fields="fields"
      :model="model"
    />
  </section>
</template>
`
}

function routerSource(compilation: ProjectCompilation, directories: ReadonlyMap<string, string>): string {
  const pages = compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    return surface?.kind === 'page' ? [surface] : []
  })
  const imports = pages.map((page, index) => (
    `import Surface${index + 1} from './surfaces/${directories.get(page.id)}/Surface.vue'`
  ))
  const routes = pages.map((page, index) => (
    `    { path: ${sourceString(page.route)}, name: ${sourceString(page.id)}, component: Surface${index + 1} },`
  ))
  const home = compilation.ir.surfacesById[compilation.ir.homeSurfaceId]
  const homeRoute = home?.kind === 'page' ? home.route : pages[0]?.route ?? '/'
  return `import { createRouter, createWebHistory } from 'vue-router'
${imports.join('\n')}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: ${sourceString(homeRoute)} },
${routes.join('\n')}
  ],
})
`
}

function appSource(): string {
  return `<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
`
}

function rawMainSource(components: ReadonlyMap<string, SourceComponentResolution>): string {
  const libraries = new Map<string, NonNullable<SourceComponentResolution['library']>>()
  const styles = new Set<string>()
  for (const resolution of components.values()) {
    resolution.styleImports.forEach(style => styles.add(style))
    if (resolution.library) {
      libraries.set(resolution.library.packageName, resolution.library)
      if (resolution.library.stylesheet)
        styles.add(resolution.library.stylesheet)
    }
  }
  const orderedLibraries = [...libraries.values()].sort((left, right) => left.packageName.localeCompare(right.packageName))
  const imports = orderedLibraries.map(library => `import ${library.plugin} from ${sourceString(library.packageName)}`)
  const styleImports = [...styles].sort().map(style => `import ${sourceString(style)}`)
  const uses = ['router', ...orderedLibraries.map(library => library.plugin)].map(item => `.use(${item})`).join('')
  return `import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
${imports.join('\n')}${imports.length ? '\n' : ''}${styleImports.join('\n')}${styleImports.length ? '\n' : ''}import './styles.css'

createApp(App)${uses}.mount('#app')
`
}

function bindingMainSource(binding: SourceConfigFormBindingResolution): string {
  const styles = [...new Set(binding.styleImports)].sort()
  return `import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
${styles.map(style => `import ${sourceString(style)}`).join('\n')}${styles.length ? '\n' : ''}import './styles.css'

createApp(App).use(router).mount('#app')
`
}

function commonFiles(context: EmitContext): SourceTextFile[] {
  const { compilation } = context
  return [
    textFile('index.html', 'text', htmlSource(compilation.ir.name)),
    textFile('src/App.vue', 'vue', appSource()),
    textFile('src/data/datasets.ts', 'typescript', datasetsSource(compilation)),
    textFile('src/data/resources.ts', 'typescript', resourcesSource(context.resources)),
    textFile('src/router.ts', 'typescript', routerSource(compilation, context.surfaceDirectories)),
    textFile('src/styles.css', 'css', projectStyles),
    textFile('src/theme.css', 'css', themeSource(compilation.ir.theme as ProjectTheme)),
    textFile('tsconfig.json', 'json', tsconfig),
    textFile('vite.config.ts', 'typescript', viteConfig),
  ]
}

function assemble<T extends RawSourceFileSetV1 | ConfigBindingFileSetV1>(
  kind: T['kind'],
  files: readonly SourceFile[],
): T {
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path))
  const result = readSourceFileSet({ version: 1, kind, entry: 'src/main.ts', files: sorted })
  if (!result.success)
    throw new Error(result.diagnostics.map(item => item.message).join('; '))
  return result.data as T
}

export function emitRawProject(
  compilation: ProjectCompilation,
  components: ReadonlyMap<string, SourceComponentResolution>,
  dependencies: Readonly<Record<string, string>>,
  resources: CollectedSourceResources,
): RawSourceFileSetV1 {
  const surfaceDirectories = uniqueSlugs(compilation.ir.surfaceOrder)
  const context: EmitContext = { compilation, components, resources, surfaceDirectories }
  const surfaceFiles = compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      return []
    return [textFile(`src/surfaces/${surfaceDirectories.get(surfaceId)}/Surface.vue`, 'vue', rawSurfaceSource(surface, context))]
  })
  return assemble('raw-source', [
    ...commonFiles(context),
    ...surfaceFiles,
    ...resources.files,
    textFile('package.json', 'json', packageManifest(compilation.ir.name, dependencies)),
    textFile('src/main.ts', 'typescript', rawMainSource(components)),
  ])
}

export function emitBindingProject(
  compilation: ProjectCompilation,
  components: ReadonlyMap<string, SourceComponentResolution>,
  binding: SourceConfigFormBindingResolution,
  resources: CollectedSourceResources,
): ConfigBindingFileSetV1 {
  const surfaceDirectories = uniqueSlugs(compilation.ir.surfaceOrder)
  const context: BindingEmitContext = { compilation, components, resources, surfaceDirectories, binding }
  const surfaceFiles = compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      return []
    const directory = surfaceDirectories.get(surfaceId)
    return [
      textFile(`src/surfaces/${directory}/Surface.vue`, 'vue', bindingSurfaceSource(surface, binding)),
      textFile(`src/surfaces/${directory}/config.ts`, 'typescript', bindingConfigSource(surface, context)),
    ]
  })
  return assemble('config-bindings', [
    ...commonFiles(context),
    ...surfaceFiles,
    ...resources.files,
    textFile('package.json', 'json', packageManifest(compilation.ir.name, binding.dependencies)),
    textFile('src/main.ts', 'typescript', bindingMainSource(binding)),
  ])
}
