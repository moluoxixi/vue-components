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
  SourceComponentResolution,
  SourceConfigFormBindingResolution,
  SourceFile,
  SourceLanguage,
  SourceTextFile,
} from '../types'
import type {
  CollectedSourceResources,
  SourceValidationEmissionPlan,
  SourceValidationFieldEmission,
} from '../types/internal'
import { readSourceFileSet } from '../validation'
import { createSourceInitialValues } from './initial-values'
import { rawValidationModuleSource } from './raw-validation'
import {
  escapeHtml,
  kebabCase,
  safeSlug,
  sortedRecord,
  sourceAttributeJson,
  sourceAttributeString,
  sourceJson,
  sourceString,
  uniqueSlugs,
} from './serialization'
import { SOURCE_CONFIG_FORM_RULE_COMPILER } from './validation'

interface EmitContext {
  compilation: ProjectCompilation
  components: ReadonlyMap<string, SourceComponentResolution>
  resources: CollectedSourceResources
  surfaceDirectories: ReadonlyMap<string, string>
  validation: SourceValidationEmissionPlan
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
type SourceInteraction = SourceSurface['interactions'][number]
type SourceStateInteraction = Extract<SourceInteraction, { kind: 'stateProjection' }>
type SourceValueInteraction = Extract<SourceInteraction, { kind: 'valueChange' }>
type SourcePrimaryInteraction = Extract<SourceSurface['interactions'][number], { kind: 'primaryUiAction' }>
type SourceSafeExpression = SourceStateInteraction['value']
type SourceSafeExpressionNode = SourceSafeExpression['ast']

interface EmittedInteraction {
  binding: SourcePrimaryInteraction
  handlerName: string
  listenerName: string
  templateEvent: string
  listenerProp: string
  itemArgumentIndex?: number
}

const demoValueImport = 'import { calculateDemoNumber, compareDemoValues, demoIncludes, demoLength, demoValuesEqual, mergeDemoNodeProps, readDemoPath, requireDemoBoolean, requireDemoNumber, requireDemoString, requireDemoValue } from \'../../demo-values.ts\''

function textFile(path: string, language: SourceLanguage, content: string): SourceTextFile {
  return { kind: 'text', path, language, content: content.endsWith('\n') ? content : `${content}\n` }
}

function projectSlug(name: string): string {
  return safeSlug(name, 'config-form-demo')
}

function packageManifest(
  name: string,
  dependencies: Readonly<Record<string, string>>,
  includeRouter = true,
): string {
  const runtimeDependencies: Record<string, string> = { vue: '3.5.33', ...dependencies }
  if (includeRouter)
    runtimeDependencies['vue-router'] = '^4.6.4'
  else
    delete runtimeDependencies['vue-router']
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
    dependencies: sortedRecord(runtimeDependencies),
    devDependencies: {
      '@vitejs/plugin-vue': '6.0.4',
      'typescript': '5.8.2',
      'vite': '7.3.1',
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
    allowImportingTsExtensions: true,
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
.demo-field__required { margin-left: 4px; color: var(--demo-color-danger, #dc2626); }
.demo-field__error { color: var(--demo-color-danger, #dc2626); font-size: 12px; }
.demo-overlay { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; overflow: hidden; border: 0; color: inherit; background: rgb(15 23 42 / 48%); }
.demo-overlay[open] { display: grid; }
.demo-overlay::backdrop { background: transparent; }
.demo-overlay--unmasked { pointer-events: none; background: transparent; }
.demo-overlay__panel { pointer-events: auto; min-width: 0; max-width: 100%; max-height: 100%; overflow: auto; background: var(--demo-color-surface-raised, #fff); box-shadow: 0 18px 48px rgb(15 23 42 / 22%); }
.demo-overlay__panel--dialog { place-self: center; width: min(var(--demo-overlay-size), calc(100% - 32px)); border-radius: var(--demo-radius-md, 8px); }
.demo-overlay__panel--drawer { position: absolute; }
.demo-overlay__panel--drawer-left, .demo-overlay__panel--drawer-right { top: 0; bottom: 0; width: min(var(--demo-overlay-size), calc(100% - 24px)); }
.demo-overlay__panel--drawer-left { left: 0; }
.demo-overlay__panel--drawer-right { right: 0; }
.demo-overlay__panel--drawer-top, .demo-overlay__panel--drawer-bottom { right: 0; left: 0; height: min(var(--demo-overlay-size), calc(100% - 24px)); }
.demo-overlay__panel--drawer-top { top: 0; }
.demo-overlay__panel--drawer-bottom { bottom: 0; }
.demo-overlay__heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--demo-color-border, #dfe3e8); }
.demo-overlay__heading h2 { margin: 0; font-size: 18px; }
.demo-overlay__close { width: 32px; height: 32px; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 24px; line-height: 1; }
.demo-overlay__panel .demo-surface { width: 100%; padding: 20px; }
@media (max-width: 640px) { .demo-surface { width: min(100% - 20px, 960px); padding-top: 20px; } }
`

const bindingViteConfig = `import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Vue()],
  build: {
    lib: {
      entry: 'src/bindings.ts',
      formats: ['es'],
      fileName: 'bindings',
    },
  },
})
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
  valueSource = 'values',
): ExpressionProperty[] {
  const values = new Map<string, string>()
  for (const [key, value] of Object.entries(resolution.staticProps ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, sourceAttributeJson(value))
  for (const [key, value] of Object.entries(node.props).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, sourceAttributeJson(value))
  const style = layoutStyle(node, resolution)
  if (style)
    values.set('style', sourceAttributeJson(style))
  for (const [key] of Object.entries(node.datasetBindings ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, `datasetViews[${sourceAttributeString(datasetViewKey(surface.id, node.id, key))}]`)
  for (const [key, reference] of Object.entries(node.resourceBindings ?? {}).sort(([left], [right]) => left.localeCompare(right)))
    values.set(key, `resources[${sourceAttributeString(reference.resourceId)}]`)
  if (node.kind === 'field' && resolution.valueProp)
    values.set(resolution.valueProp, `${valueSource}[${sourceAttributeString(node.field)}]`)
  if (node.kind === 'field' && fieldRequired(node).required) {
    values.set('required', 'true')
    values.set('aria-required', sourceAttributeString('true'))
  }
  return [...values].map(([key, expression]) => ({ key, expression }))
}

function bindingValidationDependencies(context: EmitContext): Readonly<Record<string, string>> {
  const hasRules = context.validation.surfaces.some(surface => surface.fields.length > 0)
  return hasRules
    ? {
        [SOURCE_CONFIG_FORM_RULE_COMPILER.moduleSpecifier]: SOURCE_CONFIG_FORM_RULE_COMPILER.dependencyVersion,
        zod: '^3.24.2',
      }
    : {}
}

function bindExpression(properties: readonly ExpressionProperty[], projectedNodeId?: string): string {
  if (properties.length === 0 && !projectedNodeId)
    return ''
  const expression = `{ ${properties.map(item => `${sourceAttributeString(item.key)}: ${item.expression}`).join(', ')} }`
  if (projectedNodeId) {
    return ` v-bind="mergeDemoNodeProps(${expression}, reactionProjection.props[${sourceAttributeString(projectedNodeId)}], reactionProjection.states[${sourceAttributeString(projectedNodeId)}])"`
  }
  return ` v-bind="${expression}"`
}

function renderTag(resolution: SourceComponentResolution): string {
  return !resolution.library && resolution.moduleSpecifier ? resolution.importName : resolution.tag
}

function pascalIdentifier(value: string, fallback: string): string {
  const words = value.split(/[^a-z0-9]+/iu).filter(Boolean)
  const identifier = words.map(word => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join('')
  return identifier && /^[A-Z]/u.test(identifier) ? identifier : fallback
}

function eventListenerProp(event: string): string {
  const camelized = event.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())
  return `on${camelized[0]?.toUpperCase() ?? ''}${camelized.slice(1)}`
}

function emittedInteractions(surface: SourceSurface, context: EmitContext): EmittedInteraction[] {
  const usedNames = new Set<string>()
  return surface.interactions.flatMap((binding, index) => {
    if (binding.kind !== 'primaryUiAction')
      return []
    const node = surface.nodesById[binding.nodeId]
    if (!node)
      throw new Error(`Primary UI action targets a missing node: ${surface.id}/${binding.nodeId}`)
    const listener = componentForNode(node, context.components).semanticListeners?.[binding.trigger]
    if (!listener) {
      throw new Error(
        `Component ${node.component} does not resolve semantic trigger ${binding.trigger} for ${surface.id}/${node.id}.`,
      )
    }
    const baseName = `handle${pascalIdentifier(binding.id, `Interaction${index + 1}`)}`
    let handlerName = baseName
    let suffix = 2
    while (usedNames.has(handlerName)) {
      handlerName = `${baseName}${suffix}`
      suffix += 1
    }
    usedNames.add(handlerName)
    let listenerName = handlerName
    if (listener.item.kind === 'argument') {
      listenerName = `${handlerName}Listener`
      let listenerSuffix = 2
      while (usedNames.has(listenerName)) {
        listenerName = `${handlerName}Listener${listenerSuffix}`
        listenerSuffix += 1
      }
      usedNames.add(listenerName)
    }
    return [{
      binding,
      handlerName,
      listenerName,
      listenerProp: listener.listenerProp,
      templateEvent: binding.trigger === 'submit' ? `${listener.event}.prevent` : listener.event,
      ...(listener.item.kind === 'argument' ? { itemArgumentIndex: listener.item.index } : {}),
    }]
  })
}

interface ExpressionSources {
  values: string
  parameters: string
  result: string
  item: string
}

function expressionNodeSource(node: SourceSafeExpressionNode, sources: ExpressionSources): string {
  if (node.kind === 'literal')
    return sourceJson(node.value, 0)
  if (node.kind === 'reference') {
    const source = node.scope === 'values'
      ? sources.values
      : node.scope === 'parameters'
        ? sources.parameters
        : node.scope === 'result'
          ? sources.result
          : sources.item
    return `readDemoPath(${source}, ${sourceJson(node.path, 0)})`
  }
  if (node.kind === 'array')
    return `[${node.items.map(item => `requireDemoValue(${expressionNodeSource(item, sources)}, 'array')`).join(', ')}]`
  if (node.kind === 'unary') {
    const operand = expressionNodeSource(node.operand, sources)
    return node.operator === '!'
      ? `!requireDemoBoolean(${operand}, '!')`
      : node.operator === '+'
        ? `requireDemoNumber(${operand}, '+')`
        : `-requireDemoNumber(${operand}, '-')`
  }
  if (node.kind === 'binary') {
    const left = expressionNodeSource(node.left, sources)
    const right = expressionNodeSource(node.right, sources)
    if (node.operator === '==' || node.operator === '!=') {
      const comparison = `demoValuesEqual(requireDemoValue(${left}, ${sourceString(node.operator)}), requireDemoValue(${right}, ${sourceString(node.operator)}))`
      return node.operator === '==' ? `(${comparison})` : `!(${comparison})`
    }
    if (node.operator === '&&')
      return `(requireDemoBoolean(${left}, '&&') ? requireDemoBoolean(${right}, '&&') : false)`
    if (node.operator === '||')
      return `(requireDemoBoolean(${left}, '||') ? true : requireDemoBoolean(${right}, '||'))`
    if (['>', '>=', '<', '<='].includes(node.operator))
      return `compareDemoValues(${left}, ${right}, ${sourceString(node.operator as '>' | '>=' | '<' | '<=')})`
    return `calculateDemoNumber(${left}, ${right}, ${sourceString(node.operator as '+' | '-' | '*' | '/' | '%')})`
  }
  if (node.kind === 'conditional') {
    return `(requireDemoBoolean(${expressionNodeSource(node.test, sources)}, 'conditional') ? ${expressionNodeSource(node.consequent, sources)} : ${expressionNodeSource(node.alternate, sources)})`
  }
  const args = node.args.map(argument => expressionNodeSource(argument, sources))
  if (node.callee === 'coalesce')
    return `(${args.join(' ?? ') || 'null'})`
  if (node.callee === 'length')
    return `demoLength(${args[0]})`
  if (node.callee === 'trim')
    return `requireDemoString(${args[0]}, 'trim').trim()`
  if (node.callee === 'lower')
    return `requireDemoString(${args[0]}, 'lower').toLowerCase()`
  if (node.callee === 'upper')
    return `requireDemoString(${args[0]}, 'upper').toUpperCase()`
  if (node.callee === 'startsWith')
    return `requireDemoString(${args[0]}, 'startsWith').startsWith(requireDemoString(${args[1]}, 'startsWith'))`
  if (node.callee === 'endsWith')
    return `requireDemoString(${args[0]}, 'endsWith').endsWith(requireDemoString(${args[1]}, 'endsWith'))`
  return `demoIncludes(${args[0]}, ${args[1]})`
}

function expressionSource(
  expression: SourceSafeExpression,
  valuesSource: string,
  resultSource = 'undefined',
  itemSource = 'item',
  parametersSource = 'parameters.value',
): string {
  const value = expressionNodeSource(expression.ast, {
    values: valuesSource,
    parameters: parametersSource,
    result: resultSource,
    item: itemSource,
  })
  return `requireDemoValue(${value}, 'result')`
}

function fieldName(surface: SourceSurface, nodeId: string): string {
  const node = surface.nodesById[nodeId]
  if (!node || node.kind !== 'field')
    throw new Error(`Interaction target is not a field: ${surface.id}/${nodeId}`)
  return node.field
}

function requiredInteractionFields(
  surface: SourceSurface,
  interaction: SourcePrimaryInteraction,
): { field: string, nodeId: string, required: boolean }[] {
  if (!interaction.validate)
    return []
  const requested = interaction.validate.scope === 'fields'
    ? new Set(interaction.validate.fieldIds ?? [])
    : undefined
  return Object.values(surface.nodesById)
    .filter((node): node is SourceFieldNode => node.kind === 'field')
    .filter(node => !requested || requested.has(node.id))
    .filter(node => node.required === true
      || stateInteractions(surface).some(rule => rule.target.kind === 'state'
        && rule.target.nodeId === node.id && rule.target.key === 'required'))
    .map(node => ({
      field: node.field,
      nodeId: node.id,
      required: node.required === true,
    }))
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
}

function parameterBindingsSource(
  bindings: Extract<SourcePrimaryInteraction['action'], { kind: 'navigate' | 'open' }>['parameters'],
  valuesSource: string,
): string {
  if (bindings.length === 0)
    return '{}'
  return `{ ${bindings.map(binding => `${sourceString(binding.name)}: ${expressionSource(binding.value, valuesSource)}`).join(', ')} }`
}

function resultCallbackSource(
  surface: SourceSurface,
  action: Extract<SourcePrimaryInteraction['action'], { kind: 'open' }>,
  valuesSource: string,
): string {
  if (!action.onResults?.length)
    return ''
  const lines = ['(demoResult) => {']
  for (const resultBinding of action.onResults) {
    lines.push(`    if (demoResult.name === ${sourceString(resultBinding.resultName)}) {`)
    lines.push('      const resultValue = demoResult.value')
    lines.push('      const resultPatch: Record<string, unknown> = {}')
    for (const assignment of resultBinding.assignments) {
      lines.push(`      resultPatch[${sourceString(fieldName(surface, assignment.targetFieldId))}] = ${expressionSource(assignment.value, valuesSource, 'resultValue')}`)
    }
    lines.push(`      setDemoFields(resultPatch, ${sourceJson(resultBinding.assignments.map(assignment => assignment.targetFieldId), 0)})`)
    lines.push('    }')
  }
  lines.push('  }')
  return lines.join('\n')
}

function interactionHandlersSource(
  surface: SourceSurface,
  context: EmitContext,
  valuesSource: string,
  projectionStatesSource = '{}',
  actionSource = 'navigation',
  validationSource?: string,
): string {
  const interactions = emittedInteractions(surface, context)
  if (interactions.length === 0)
    return ''
  const functions: string[] = []
  for (const { binding, handlerName, itemArgumentIndex, listenerName } of interactions) {
    const required = requiredInteractionFields(surface, binding)
    const lines = [`async function ${handlerName}(item?: unknown): Promise<void> {`]
    if (binding.validate && validationSource) {
      lines.push(
        `  if (!(await ${validationSource}.validate(${sourceJson({
          surfaceId: surface.id,
          scope: binding.validate.scope,
          fieldIds: binding.validate.fieldIds ?? [],
        }, 0)})))`,
        '    return',
      )
    }
    else if (required.length > 0) {
      lines.push(`  if (!hasDemoRequiredValues(${sourceJson(required, 0)}, ${projectionStatesSource}))`, '    return')
    }
    const action = binding.action
    if (action.kind === 'navigate') {
      lines.push(`  await ${actionSource}.navigate(${sourceString(action.targetSurfaceId)}, ${parameterBindingsSource(action.parameters, valuesSource)})`)
    }
    else if (action.kind === 'back') {
      lines.push(`  ${actionSource}.back()`)
    }
    else if (action.kind === 'open') {
      const callback = resultCallbackSource(surface, action, valuesSource)
      const callbackArgument = callback ? `, ${callback}` : ''
      lines.push(`  ${actionSource}.open(${sourceString(action.targetSurfaceId)}, ${parameterBindingsSource(action.parameters, valuesSource)}${callbackArgument})`)
    }
    else if (action.kind === 'closeCurrent') {
      lines.push(action.result
        ? `  ${actionSource}.closeCurrent({ name: ${sourceString(action.result.name)}, value: ${expressionSource(action.result.value, valuesSource)} })`
        : `  ${actionSource}.closeCurrent()`)
    }
    else {
      lines.push(`  ${actionSource}.closeAll()`)
    }
    lines.push('}')
    functions.push(lines.join('\n'))
    if (itemArgumentIndex !== undefined) {
      functions.push([
        `function ${listenerName}(...demoArgs: unknown[]): Promise<void> {`,
        `  return ${handlerName}(demoArgs[${itemArgumentIndex}])`,
        '}',
      ].join('\n'))
    }
  }
  return functions.join('\n\n')
}

function interactionExpressions(interaction: SourceInteraction): SourceSafeExpression[] {
  if (interaction.kind === 'stateProjection')
    return [interaction.value]
  if (interaction.kind === 'valueChange') {
    return [
      ...(interaction.when ? [interaction.when] : []),
      ...(interaction.action.kind === 'set' ? [interaction.action.value] : []),
    ]
  }
  const action = interaction.action
  if (action.kind === 'navigate')
    return action.parameters.map(binding => binding.value)
  if (action.kind === 'open') {
    return [
      ...action.parameters.map(binding => binding.value),
      ...(action.onResults ?? []).flatMap(binding => binding.assignments.map(assignment => assignment.value)),
    ]
  }
  return action.kind === 'closeCurrent' && action.result ? [action.result.value] : []
}

function expressionNodes(node: SourceSafeExpressionNode): SourceSafeExpressionNode[] {
  if (node.kind === 'literal' || node.kind === 'reference')
    return [node]
  if (node.kind === 'array')
    return [node, ...node.items.flatMap(expressionNodes)]
  if (node.kind === 'unary')
    return [node, ...expressionNodes(node.operand)]
  if (node.kind === 'binary')
    return [node, ...expressionNodes(node.left), ...expressionNodes(node.right)]
  if (node.kind === 'conditional') {
    return [
      node,
      ...expressionNodes(node.test),
      ...expressionNodes(node.consequent),
      ...expressionNodes(node.alternate),
    ]
  }
  return [node, ...node.args.flatMap(expressionNodes)]
}

function nodeUsesValueScope(surface: SourceSurface, nodeId: string): boolean {
  let parentId = surface.nodesById[nodeId]?.placement.parentId ?? null
  const visited = new Set<string>()
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = surface.nodesById[parentId]
    if (!parent)
      return false
    if (parent.kind === 'layout' && parent.valueScope)
      return true
    parentId = parent.placement.parentId
  }
  return false
}

function assertSupportedInteractionScopes(surface: SourceSurface): void {
  const valueRules = surface.interactions.filter((interaction): interaction is SourceValueInteraction => interaction.kind === 'valueChange')
  const edges = new Map<string, string[]>()
  for (const rule of valueRules) {
    for (const dependency of rule.dependencies)
      edges.set(dependency, [...(edges.get(dependency) ?? []), rule.action.targetFieldId])
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId))
      return true
    if (visited.has(nodeId))
      return false
    visiting.add(nodeId)
    if ((edges.get(nodeId) ?? []).some(visit))
      return true
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }
  if ([...edges.keys()].some(visit))
    throw new Error(`Generated value interactions contain a cycle for surface ${surface.id}.`)

  for (const interaction of surface.interactions) {
    const anchorNodeIds = interaction.kind === 'stateProjection'
      ? [interaction.target.nodeId]
      : interaction.kind === 'valueChange'
        ? [
            ...interaction.dependencies,
            interaction.action.targetFieldId,
            ...(interaction.action.kind === 'copy' ? [interaction.action.sourceFieldId] : []),
          ]
        : [interaction.nodeId]
    const scopedAnchor = anchorNodeIds.some(nodeId => nodeUsesValueScope(surface, nodeId))
    if (interaction.kind !== 'primaryUiAction' && scopedAnchor) {
      throw new Error(
        `Generated value and state interactions cannot preserve scoped values for interaction ${surface.id}/${interaction.id}.`,
      )
    }
    for (const expression of interactionExpressions(interaction)) {
      for (const node of expressionNodes(expression.ast)) {
        if (node.kind !== 'reference')
          continue
        if (interaction.kind !== 'primaryUiAction' && (node.scope === 'item' || node.scope === 'result')) {
          throw new Error(
            `Generated value and state interactions cannot use ${node.scope} scope for interaction ${surface.id}/${interaction.id}.`,
          )
        }
        if (node.scope === 'values' && scopedAnchor && node.selector !== 'root') {
          throw new Error(
            `Generated direct handlers cannot resolve scoped values for interaction ${surface.id}/${interaction.id}.`,
          )
        }
      }
    }
    if (interaction.kind === 'primaryUiAction' && interaction.action.kind === 'open') {
      for (const assignment of interaction.action.onResults?.flatMap(binding => binding.assignments) ?? []) {
        if (surface.scopedFields.some(field => field.nodeId === assignment.targetFieldId && field.scopeId)) {
          throw new Error(
            `Generated direct handlers cannot assign a scoped result for interaction ${surface.id}/${interaction.id}.`,
          )
        }
      }
    }
  }
}

function stateInteractions(surface: SourceSurface): SourceStateInteraction[] {
  return surface.interactions.filter((interaction): interaction is SourceStateInteraction => interaction.kind === 'stateProjection')
}

function valueInteractions(surface: SourceSurface): SourceValueInteraction[] {
  return surface.interactions.filter((interaction): interaction is SourceValueInteraction => interaction.kind === 'valueChange')
}

function surfaceFunctionSuffix(surface: SourceSurface, context: EmitContext): string {
  return pascalIdentifier(context.surfaceDirectories.get(surface.id) ?? surface.id, 'Surface')
}

function uniqueRuleFunctionNames(
  surface: SourceSurface,
  suffix: string,
): ReadonlyMap<string, string> {
  const names = new Map<string, string>()
  const used = new Set<string>()
  valueInteractions(surface).forEach((rule, index) => {
    const base = `apply${suffix}${pascalIdentifier(rule.id, `ValueRule${index + 1}`)}`
    let name = base
    let duplicate = 2
    while (used.has(name)) {
      name = `${base}${duplicate}`
      duplicate += 1
    }
    used.add(name)
    names.set(rule.id, name)
  })
  return names
}

function stateProjectionFunctionName(surface: SourceSurface, context: EmitContext): string {
  return `project${surfaceFunctionSuffix(surface, context)}DemoState`
}

function valueSettlementFunctionName(surface: SourceSurface, context: EmitContext): string {
  return `settle${surfaceFunctionSuffix(surface, context)}DemoValues`
}

function valueDependencyHandlerNames(
  surface: SourceSurface,
  context: EmitContext,
): ReadonlyMap<string, string> {
  const dependencies = [...new Set(valueInteractions(surface).flatMap(rule => rule.dependencies))].sort()
  return new Map(dependencies.map((nodeId, index) => [
    nodeId,
    `handle${surfaceFunctionSuffix(surface, context)}${pascalIdentifier(nodeId, 'Field')}ValueChange${index + 1}`,
  ]))
}

function surfaceInteractionFunctionsSource(surface: SourceSurface, context: EmitContext): string {
  const stateRules = stateInteractions(surface)
  const valueRules = valueInteractions(surface)
  if (stateRules.length === 0 && valueRules.length === 0)
    return ''

  const blocks: string[] = []
  if (stateRules.length > 0) {
    const lines = [
      `export function ${stateProjectionFunctionName(surface, context)}(`,
      '  values: Readonly<Record<string, unknown>>,',
      '  parameters: Readonly<Record<string, unknown>>,',
      '): DemoReactionProjection {',
      '  const states: DemoReactionProjection[\'states\'] = {}',
      '  const props: DemoReactionProjection[\'props\'] = {}',
    ]
    for (const rule of stateRules) {
      const value = expressionSource(rule.value, 'values', 'undefined', 'undefined', 'parameters')
      if (rule.target.kind === 'state') {
        lines.push(
          `  states[${sourceString(rule.target.nodeId)}] = { ...states[${sourceString(rule.target.nodeId)}], ${rule.target.key}: requireDemoBoolean(${value}, ${sourceString(`state ${rule.id}`)}) }`,
        )
      }
      else {
        lines.push(
          `  writeDemoPath(props[${sourceString(rule.target.nodeId)}] ??= {}, ${sourceJson(rule.target.path, 0)}, ${value})`,
        )
      }
    }
    lines.push('  return { states, props }', '}')
    blocks.push(lines.join('\n'))
  }

  if (valueRules.length > 0) {
    const suffix = surfaceFunctionSuffix(surface, context)
    const functionNames = uniqueRuleFunctionNames(surface, suffix)
    for (const rule of valueRules) {
      const lines = [
        `function ${functionNames.get(rule.id)}(`,
        '  staged: Record<string, unknown>,',
        '  parameters: Readonly<Record<string, unknown>>,',
        '): void {',
      ]
      if (rule.when) {
        const when = expressionSource(rule.when, 'staged', 'undefined', 'undefined', 'parameters')
        lines.push(`  if (!requireDemoBoolean(${when}, ${sourceString(`condition ${rule.id}`)}))`, '    return')
      }
      const targetField = fieldName(surface, rule.action.targetFieldId)
      if (rule.action.kind === 'clear') {
        lines.push(`  delete staged[${sourceString(targetField)}]`)
      }
      else if (rule.action.kind === 'copy') {
        const sourceField = fieldName(surface, rule.action.sourceFieldId)
        lines.push(
          `  staged[${sourceString(targetField)}] = structuredClone(requireDemoValue(readDemoPath(staged, [${sourceString(sourceField)}]), ${sourceString(`copy ${rule.id}`)}))`,
        )
      }
      else {
        lines.push(
          `  staged[${sourceString(targetField)}] = structuredClone(${expressionSource(rule.action.value, 'staged', 'undefined', 'undefined', 'parameters')})`,
        )
      }
      lines.push('}')
      blocks.push(lines.join('\n'))
    }

    const allFields = Object.values(surface.nodesById)
      .filter((node): node is SourceFieldNode => node.kind === 'field')
      .sort((left, right) => left.id.localeCompare(right.id))
    const settle = [
      `export function ${valueSettlementFunctionName(surface, context)}(`,
      '  previousValues: Readonly<Record<string, unknown>>,',
      '  candidateValues: Readonly<Record<string, unknown>>,',
      '  changedNodeIds: readonly string[],',
      '  parameters: Readonly<Record<string, unknown>>,',
      '): Record<string, unknown> {',
      '  const staged = structuredClone(candidateValues)',
      '  const changed = new Set(changedNodeIds.filter((nodeId) => {',
      '    switch (nodeId) {',
      ...allFields.map(node => `      case ${sourceString(node.id)}: return demoRecordValueChanged(previousValues, candidateValues, ${sourceString(node.field)})`),
      '      default: return false',
      '    }',
      '  }))',
      ...valueRules.map((rule, index) => `  let executedRule${index + 1} = false`),
      '  let progress = true',
      '  while (progress) {',
      '    progress = false',
    ]
    valueRules.forEach((rule, index) => {
      const targetField = fieldName(surface, rule.action.targetFieldId)
      const dependency = rule.dependencies.map(nodeId => `changed.has(${sourceString(nodeId)})`).join(' || ') || 'false'
      settle.push(
        `    if (!executedRule${index + 1} && (${dependency})) {`,
        `      executedRule${index + 1} = true`,
        '      progress = true',
        `      const hadTarget = Object.hasOwn(staged, ${sourceString(targetField)})`,
        `      const previousTarget = readDemoPath(staged, [${sourceString(targetField)}])`,
        `      ${functionNames.get(rule.id)}(staged, parameters)`,
        `      if (hadTarget !== Object.hasOwn(staged, ${sourceString(targetField)}) || !demoValuesEqual(previousTarget, readDemoPath(staged, [${sourceString(targetField)}])))`,
        `        changed.add(${sourceString(rule.action.targetFieldId)})`,
        '    }',
      )
    })
    settle.push('  }', '  return staged', '}')
    blocks.push(settle.join('\n'))
  }
  return blocks.join('\n\n')
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
    `${indent}/>`,
  ]
}

function renderRawNode(
  surface: SourceSurface,
  nodeId: string,
  context: EmitContext,
  depth: number,
  valueSource = 'values',
): string[] {
  const node = surface.nodesById[nodeId]
  if (!node)
    return []
  const resolution = componentForNode(node, context.components)
  const tag = renderTag(resolution)
  const indent = '  '.repeat(depth)
  const projected = stateInteractions(surface).some(interaction => interaction.target.nodeId === node.id)
  const visible = stateInteractions(surface).some(interaction => interaction.target.nodeId === node.id
    && interaction.target.kind === 'state' && interaction.target.key === 'visible')
  const attributes = [
    ` data-node-id="${escapeHtml(node.id)}"`,
    bindExpression(nodeProperties(surface, node, resolution, valueSource), projected ? node.id : undefined),
  ]
  if (visible && node.kind !== 'field')
    attributes.push(` v-if="reactionProjection.states[${sourceAttributeString(node.id)}]?.visible !== false"`)
  if (node.kind === 'field' && resolution.trigger) {
    attributes.push(` @${kebabCase(resolution.trigger)}="updateValue(${valueSource}, ${sourceAttributeString(node.field)}, ${sourceAttributeString(node.id)}, $event)"`)
  }
  if (
    node.kind === 'field'
    && rawNeedsValidation(surface, context)
    && resolution.blurTrigger
    && node.validateOn.includes('blur')
  ) {
    attributes.push(` @${kebabCase(resolution.blurTrigger)}="void validateDemoFields([${sourceAttributeString(node.id)}])"`)
  }
  const listeners = new Map<string, string[]>()
  for (const interaction of emittedInteractions(surface, context).filter(item => item.binding.nodeId === node.id)) {
    const handlers = listeners.get(interaction.templateEvent) ?? []
    handlers.push(interaction.listenerName)
    listeners.set(interaction.templateEvent, handlers)
  }
  for (const [event, handlers] of listeners)
    attributes.push(` @${event}="${handlers.length === 1 ? handlers[0] : `[${handlers.join(', ')}]`}"`)
  const children: string[] = []
  let childValueSource = valueSource
  if (node.kind === 'layout') {
    if (node.valueScope?.kind === 'object') {
      childValueSource = `demoObject(${valueSource}[${sourceAttributeString(node.valueScope.field)}], ${sourceAttributeString(node.id)})`
    }
    else if (node.valueScope?.kind === 'array') {
      const suffix = pascalIdentifier(node.id, 'Scope')
      const rowName = `scopeRow${suffix}`
      const indexName = `scopeIndex${suffix}`
      attributes.push(` v-for="(${rowName}, ${indexName}) in demoArray(${valueSource}[${sourceAttributeString(node.valueScope.field)}], ${sourceAttributeString(node.id)})"`)
      attributes.push(node.valueScope.itemKey
        ? ` :key="String(${rowName}[${sourceAttributeString(node.valueScope.itemKey)}] ?? ${indexName})"`
        : ` :key="${indexName}"`)
      childValueSource = rowName
    }
    for (const [slot, childIds] of Object.entries(node.slots).sort(([left], [right]) => left.localeCompare(right))) {
      if (slot === 'default') {
        for (const childId of childIds)
          children.push(...renderRawNode(surface, childId, context, depth + 1, childValueSource))
      }
      else {
        children.push(`${indent}  <template #${slot}>`)
        for (const childId of childIds)
          children.push(...renderRawNode(surface, childId, context, depth + 2, childValueSource))
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
  const requiredBaseline = fieldRequired(node).required === true
  const projectedRequired = stateInteractions(surface).some(interaction => interaction.target.nodeId === node.id
    && interaction.target.kind === 'state' && interaction.target.key === 'required')
  const requiredMarker = node.label && (requiredBaseline || projectedRequired)
    ? projectedRequired
      ? `<span v-if="reactionProjection.states[${sourceAttributeString(node.id)}]?.required ?? ${requiredBaseline}" class="demo-field__required" aria-hidden="true">*</span>`
      : '<span class="demo-field__required" aria-hidden="true">*</span>'
    : ''
  return [
    `${indent}<div class="demo-field"${visible ? ` v-if="reactionProjection.states[${sourceAttributeString(node.id)}]?.visible !== false"` : ''}>`,
    ...(node.label ? [`${indent}  <span class="demo-field__label">${escapeHtml(node.label)}${requiredMarker}</span>`] : []),
    ...componentLines.map(line => `  ${line}`),
    ...(rawNeedsValidation(surface, context)
      ? [`${indent}  <span v-if="validationErrors[${sourceAttributeString(node.id)}]?.length" class="demo-field__error" role="alert">{{ validationErrors[${sourceAttributeString(node.id)}]?.[0] }}</span>`]
      : []),
    `${indent}</div>`,
  ]
}

function surfaceUses(surface: SourceSurface, key: 'datasetBindings' | 'resourceBindings'): boolean {
  return Object.values(surface.nodesById).some(node => Object.keys(node[key] ?? {}).length > 0)
}

function surfaceParameterDefaults(surface: SourceSurface): Record<string, unknown> {
  return Object.fromEntries(surface.parameters.flatMap(parameter => (
    parameter.defaultValue === undefined ? [] : [[parameter.name, parameter.defaultValue]]
  )))
}

function interactionUtilitiesSource(valuesSource: string, setDemoFieldsBody: string): string {
  return `function hasDemoRequiredValues(
  fields: readonly { field: string, nodeId: string, required: boolean }[],
  projectedStates: Readonly<Record<string, { required?: boolean }>>,
): boolean {
  return fields.every((entry) => {
    if (!(projectedStates[entry.nodeId]?.required ?? entry.required))
      return true
    const value = ${valuesSource}[entry.field]
    return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)
  })
}

function setDemoFields(
  patch: Readonly<Record<string, unknown>>,
  changedNodeIds: readonly string[] = [],
): void {
  ${setDemoFieldsBody}
}`
}

function fieldScopeChain(
  surface: SourceSurface,
  nodeId: string,
): readonly { field: string, kind: 'array' | 'object' }[] {
  const field = surface.scopedFields.find(item => item.nodeId === nodeId)
  if (!field)
    throw new Error(`Canonical scoped field is missing for ${surface.id}/${nodeId}.`)
  const scopes = new Map(surface.valueScopes.map(scope => [scope.nodeId, scope]))
  const chain: { field: string, kind: 'array' | 'object' }[] = []
  const visited = new Set<string>()
  let scopeId = field.scopeId
  while (scopeId !== undefined) {
    if (visited.has(scopeId))
      throw new Error(`Canonical value scopes contain a cycle for ${surface.id}/${nodeId}.`)
    visited.add(scopeId)
    const scope = scopes.get(scopeId)
    if (!scope)
      throw new Error(`Canonical value scope ${scopeId} is missing for ${surface.id}/${nodeId}.`)
    chain.unshift({ field: scope.field, kind: scope.kind })
    scopeId = scope.parentId
  }
  return chain
}

function rawNeedsValidation(surface: SourceSurface, context: EmitContext): boolean {
  return validationFields(surface, context).length > 0
    || Object.values(surface.nodesById).some(node => node.kind === 'field' && node.required === true)
    || stateInteractions(surface).some(interaction => (
      interaction.target.kind === 'state' && interaction.target.key === 'required'
    ))
    || surface.interactions.some(interaction => interaction.kind === 'primaryUiAction' && interaction.validate !== undefined)
}

function rawValidationSource(
  surface: SourceSurface,
  context: EmitContext,
  hasStateProjection: boolean,
): string {
  const fields = Object.values(surface.nodesById)
    .filter((node): node is SourceFieldNode => node.kind === 'field')
    .sort((left, right) => left.id.localeCompare(right.id))
  const definitions = fields.map((node) => {
    const required = fieldRequired(node)
    return `  ${sourceString(node.id)}: {
    field: ${sourceString(node.field)},
    required: ${required.required === true},
    validateOn: ${sourceJson(node.validateOn as unknown as ModelJsonValue)},
    scopes: ${sourceJson(fieldScopeChain(surface, node.id) as unknown as ModelJsonValue)},
    validator: demoFieldValidators[${sourceString(node.id)}]!,
    label: ${sourceString(node.label ?? node.field)},
  },`
  }).join('\n')
  const projectedRequired = hasStateProjection
    ? 'reactionProjection.value.states[nodeId]?.required'
    : 'undefined'
  return `interface DemoValidationField {
  field: string
  label: string
  required: boolean
  validateOn: readonly ('blur' | 'change' | 'submit')[]
  scopes: readonly { field: string, kind: 'array' | 'object' }[]
  validator: DemoFieldValidator
}

interface DemoValidationRequest {
  surfaceId: string
  scope: 'surface' | 'fields'
  fieldIds: readonly string[]
}

const demoValidationFields: Readonly<Record<string, DemoValidationField>> = {
${definitions}
}
const validationErrors = reactive<Record<string, string[]>>({})

function collectDemoFieldInstances(definition: DemoValidationField): readonly {
  value: unknown
  values: Record<string, unknown>
}[] {
  let containers: Record<string, unknown>[] = [values]
  for (const scope of definition.scopes) {
    containers = containers.flatMap((container) => {
      const scopedValue = container[scope.field]
      return scope.kind === 'object'
        ? [demoObject(scopedValue, scope.field)]
        : demoArray(scopedValue, scope.field)
    })
  }
  return containers.map(container => ({ value: container[definition.field], values: container }))
}

async function validateDemoFields(nodeIds: readonly string[], requireInstance = false): Promise<boolean> {
  let valid = true
  for (const nodeId of [...new Set(nodeIds)]) {
    const definition = demoValidationFields[nodeId]
    if (!definition) {
      valid = false
      continue
    }
    const instances = collectDemoFieldInstances(definition)
    const errors: string[] = []
    if (requireInstance && instances.length === 0)
      errors.push(\`No live field instance exists for \${definition.label}.\`)
    for (const instance of instances) {
      const required = ${projectedRequired} ?? definition.required
      errors.push(...definition.validator(instance.value, instance.values, required))
    }
    validationErrors[nodeId] = errors
    if (errors.length > 0)
      valid = false
  }
  return valid
}

const validation = {
  async validate(request: DemoValidationRequest): Promise<boolean> {
    if (request.surfaceId !== ${sourceString(surface.id)})
      return false
    const nodeIds = request.scope === 'surface'
      ? Object.keys(demoValidationFields)
      : request.fieldIds
    if (request.scope === 'fields' && nodeIds.length === 0)
      return false
    return validateDemoFields(nodeIds, request.scope === 'fields')
  },
}
`
}

function rawSurfaceSource(surface: SourceSurface, context: EmitContext): string {
  assertSupportedInteractionScopes(surface)
  const initialValues = createSourceInitialValues(surface)
  const namedImports = new Map<string, Set<string>>()
  for (const node of Object.values(surface.nodesById)) {
    const resolution = componentForNode(node, context.components)
    if (!resolution.library && resolution.moduleSpecifier) {
      const imports = namedImports.get(resolution.moduleSpecifier) ?? new Set<string>()
      imports.add(resolution.importName)
      namedImports.set(resolution.moduleSpecifier, imports)
    }
  }
  const interactions = emittedInteractions(surface, context)
  const stateRules = stateInteractions(surface)
  const valueRules = valueInteractions(surface)
  const needsValidation = rawNeedsValidation(surface, context)
  const usesExpressions = stateRules.length > 0 || valueRules.length > 0
    || interactions.some(interaction => interactionExpressions(interaction.binding).length > 0)
  const generatedValueImports = [
    ...(stateRules.length > 0 ? [stateProjectionFunctionName(surface, context)] : []),
    ...(valueRules.length > 0 ? [valueSettlementFunctionName(surface, context)] : []),
  ]
  const imports = [
    'import { computed, reactive } from \'vue\'',
    ...(needsValidation
      ? ['import { demoFieldValidators, type DemoFieldValidator } from \'./validation.ts\'']
      : []),
    ...(interactions.length > 0 ? ['import { useDemoNavigation } from \'../../demo-navigation.ts\''] : []),
    ...(usesExpressions ? [demoValueImport] : []),
    ...(generatedValueImports.length > 0
      ? [`import { ${generatedValueImports.join(', ')} } from '../../demo-values.ts'`]
      : []),
    ...[...namedImports].sort(([left], [right]) => left.localeCompare(right)).map(([moduleSpecifier, names]) => (
      `import { ${[...names].sort().join(', ')} } from ${sourceString(moduleSpecifier)}`
    )),
    ...(surfaceUses(surface, 'datasetBindings') ? ['import { datasetViews } from \'../../data/datasets.ts\''] : []),
    ...(surfaceUses(surface, 'resourceBindings') ? ['import { resources } from \'../../data/resources.ts\''] : []),
  ]
  const setDemoFieldsBody = valueRules.length > 0
    ? `const previousValues = structuredClone(values)
  const candidateValues = { ...previousValues, ...structuredClone(patch) }
  const settledValues = ${valueSettlementFunctionName(surface, context)}(previousValues, candidateValues, changedNodeIds, parameters.value)
  Object.keys(values).forEach((field) => {
    if (!Object.hasOwn(settledValues, field))
      delete values[field]
  })
  Object.assign(values, settledValues)`
    : 'Object.assign(values, structuredClone(patch))'
  const interactionScript = `

${interactions.length > 0 ? 'const navigation = useDemoNavigation()\n' : ''}

${interactionUtilitiesSource('values', setDemoFieldsBody)}

${interactionHandlersSource(
  surface,
  context,
  'values',
  stateRules.length > 0 ? 'reactionProjection.value.states' : '{}',
  'navigation',
  needsValidation ? 'validation' : undefined,
)}`
  const projectionScript = stateRules.length > 0
    ? `
const reactionProjection = computed(() => ${stateProjectionFunctionName(surface, context)}(values, parameters.value))`
    : ''
  const scopeUtilities = surface.valueScopes.length === 0 && !needsValidation
    ? ''
    : `

function demoObject(value: unknown, nodeId: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(\`Value scope \${nodeId} must contain an object.\`)
  return value as Record<string, unknown>
}

function demoArray(value: unknown, nodeId: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || Array.isArray(item)))
    throw new Error(\`Value scope \${nodeId} must contain object rows.\`)
  return value as Record<string, unknown>[]
}`
  const validationRuntime = needsValidation
    ? `\n\n${rawValidationSource(surface, context, stateRules.length > 0)}`
    : ''
  const script = `${imports.join('\n')}

const surfaceProps = defineProps<{ demoParameters?: Readonly<Record<string, unknown>> }>()
const parameters = computed<Record<string, unknown>>(() => ({
  ...${sourceJson(surfaceParameterDefaults(surface))},
  ...(surfaceProps.demoParameters ?? {}),
}))

const values = reactive<Record<string, unknown>>(${sourceJson(initialValues)})${projectionScript}${scopeUtilities}${validationRuntime}

function updateValue(targetValues: Record<string, unknown>, field: string, nodeId: string, payload: unknown): void {
  const target = payload && typeof payload === 'object' && 'target' in payload
    ? (payload as { target?: { checked?: unknown, value?: unknown, type?: unknown } }).target
    : undefined
  const value = target?.type === 'checkbox' ? Boolean(target.checked) : (target?.value ?? payload)
  if (targetValues === values)
    setDemoFields({ [field]: value }, [nodeId])
  else
    targetValues[field] = structuredClone(value)
  ${needsValidation ? 'if (demoValidationFields[nodeId]?.validateOn.includes(\'change\'))\n    void validateDemoFields([nodeId])' : ''}
}${interactionScript}`
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
  return {
    ...(node.required === undefined ? {} : { required: node.required }),
    ...(node.requiredMessage === undefined ? {} : { message: node.requiredMessage }),
  }
}

function validationFields(
  surface: SourceSurface,
  context: EmitContext,
): readonly SourceValidationFieldEmission[] {
  const plan = context.validation.surfaces.find(item => item.surfaceId === surface.id)
  if (!plan)
    throw new Error(`Validation emission plan is missing Surface ${surface.id}.`)
  return plan.fields
}

function validationIdentifier(
  surface: SourceSurface,
  context: EmitContext,
  nodeId: string,
): string | undefined {
  const index = validationFields(surface, context).findIndex(item => item.nodeId === nodeId)
  return index < 0 ? undefined : `compiledValidation${index + 1}`
}

function compiledValidationSource(surface: SourceSurface, context: EmitContext): string {
  return validationFields(surface, context).map((field, index) => (
    `const compiledValidation${index + 1} = ${SOURCE_CONFIG_FORM_RULE_COMPILER.importName}(${sourceJson(field.ruleSet as unknown as ModelJsonValue)})`
  )).join('\n')
}

function configNodeSource(
  surface: SourceSurface,
  nodeId: string,
  context: BindingEmitContext,
  interactions: readonly EmittedInteraction[],
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
  const listeners = new Map<string, string[]>()
  for (const interaction of interactions.filter(item => item.binding.nodeId === node.id)) {
    const handlers = listeners.get(interaction.listenerProp) ?? []
    handlers.push(interaction.listenerName)
    listeners.set(interaction.listenerProp, handlers)
  }
  const valueHandler = valueDependencyHandlerNames(surface, context).get(node.id)
  if (node.kind === 'field' && valueHandler && resolution.trigger) {
    const listenerProp = eventListenerProp(resolution.trigger)
    listeners.set(listenerProp, [...(listeners.get(listenerProp) ?? []), valueHandler])
  }
  for (const [key, handlers] of listeners) {
    if (handlers.length !== 1) {
      throw new Error(
        `ConfigForm binding cannot preserve multiple listeners for ${surface.id}/${node.id}/${key}.`,
      )
    }
    properties.push({
      key,
      expression: handlers[0]!,
    })
  }
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
    const validation = validationFields(surface, context).find(item => item.nodeId === node.id)
    const compiledValidation = validationIdentifier(surface, context, node.id)
    lines.push(`${childIndent}field: ${sourceString(node.field)},`)
    if (node.label !== undefined)
      lines.push(`${childIndent}label: ${sourceString(node.label)},`)
    if (node.defaultValue !== undefined)
      lines.push(`${childIndent}defaultValue: ${sourceJson(node.defaultValue)},`)
    if (node.validateOn.length > 0)
      lines.push(`${childIndent}validateOn: ${sourceJson(node.validateOn as unknown as ModelJsonValue)},`)
    if (node.required === true)
      lines.push(`${childIndent}required: true,`)
    if (node.requiredMessage !== undefined)
      lines.push(`${childIndent}requiredMessage: ${sourceString(node.requiredMessage)},`)
    if (compiledValidation)
      lines.push(`${childIndent}schema: ${compiledValidation}.schema,`)
    if (compiledValidation && validation?.attachValidator)
      lines.push(`${childIndent}validator: ${compiledValidation}.validator,`)
    if (resolution.valueProp)
      lines.push(`${childIndent}valueProp: ${sourceString(resolution.valueProp)},`)
    if (resolution.trigger)
      lines.push(`${childIndent}trigger: ${sourceString(resolution.trigger)},`)
    if (resolution.blurTrigger)
      lines.push(`${childIndent}blurTrigger: ${sourceString(resolution.blurTrigger)},`)
  }
  if (node.kind === 'layout') {
    if (node.valueScope !== undefined)
      lines.push(`${childIndent}valueScope: ${sourceJson(node.valueScope)},`)
    lines.push(`${childIndent}slots: {`)
    for (const [slot, children] of Object.entries(node.slots).sort(([left], [right]) => left.localeCompare(right))) {
      lines.push(`${childIndent}  ${sourceString(slot)}: [`)
      for (const childId of children)
        lines.push(configNodeSource(surface, childId, context, interactions, depth + 3))
      lines.push(`${childIndent}  ],`)
    }
    lines.push(`${childIndent}},`)
  }
  lines.push(`${indent}},`)
  return lines.join('\n')
}

function surfaceInitialModel(surface: SourceSurface): ModelJsonObject {
  return createSourceInitialValues(surface)
}

const bindingHostSource = `export interface ConfigBindingResult {
  name: string
  value: unknown
}

export interface ConfigBindingActions {
  navigate: (surfaceId: string, parameters: Readonly<Record<string, unknown>>) => void | Promise<void>
  back: () => void
  open: (
    surfaceId: string,
    parameters: Readonly<Record<string, unknown>>,
    complete?: (result: ConfigBindingResult) => void,
  ) => void
  closeCurrent: (result?: ConfigBindingResult) => void
  closeAll: () => void
}

export interface ConfigBindingValidationRequest {
  surfaceId: string
  scope: 'surface' | 'fields'
  fieldIds: readonly string[]
}

export interface ConfigBindingValidation {
  validate: (request: ConfigBindingValidationRequest) => Promise<boolean>
}
`

function bindingEntrySource(context: BindingEmitContext): string {
  const styleImports = [...new Set(context.binding.styleImports)].sort()
  const lines = styleImports.map(style => `import ${sourceString(style)}`)
  lines.push('export type * from \'./host.ts\'')
  for (const surfaceId of context.compilation.ir.surfaceOrder) {
    const surface = context.compilation.ir.surfacesById[surfaceId]
    if (!surface)
      continue
    const suffix = surfaceFunctionSuffix(surface, context)
    const prefix = `${suffix[0]?.toLowerCase() ?? 's'}${suffix.slice(1)}`
    const exports = [
      `createFields as create${suffix}Fields`,
      `formConfig as ${prefix}FormConfig`,
      `initialModel as ${prefix}InitialModel`,
      ...(stateInteractions(surface).length > 0
        ? [`createReactionProjection as create${suffix}ReactionProjection`]
        : []),
    ]
    const path = `./surfaces/${context.surfaceDirectories.get(surface.id)}/config.ts`
    lines.push(`export { ${exports.join(', ')} } from ${sourceString(path)}`)
    if (emittedInteractions(surface, context).length > 0 || valueInteractions(surface).length > 0)
      lines.push(`export type { SurfaceConfigContext as ${suffix}ConfigContext } from ${sourceString(path)}`)
  }
  return `${lines.join('\n')}\n`
}

function bindingConfigSource(surface: SourceSurface, context: BindingEmitContext): string {
  assertSupportedInteractionScopes(surface)
  const interactions = emittedInteractions(surface, context)
  const stateRules = stateInteractions(surface)
  const valueRules = valueInteractions(surface)
  const valueHandlers = valueDependencyHandlerNames(surface, context)
  const hasContext = interactions.length > 0 || valueRules.length > 0
  const usesExpressions = stateRules.length > 0 || valueRules.length > 0
    || interactions.some(interaction => interactionExpressions(interaction.binding).length > 0)
  const generatedValueImports = [
    ...(stateRules.length > 0 ? [stateProjectionFunctionName(surface, context)] : []),
    ...(valueRules.length > 0 ? [valueSettlementFunctionName(surface, context)] : []),
  ]
  const compiledValidations = validationFields(surface, context)
  const imports = [
    ...(compiledValidations.length > 0
      ? [`import { ${SOURCE_CONFIG_FORM_RULE_COMPILER.importName} } from ${sourceString(SOURCE_CONFIG_FORM_RULE_COMPILER.moduleSpecifier)}`]
      : []),
    ...(interactions.length > 0
      ? ['import type { ConfigBindingActions, ConfigBindingValidation } from \'../../host.ts\'']
      : []),
    ...(usesExpressions ? [demoValueImport] : []),
    ...(generatedValueImports.length > 0
      ? [`import { ${generatedValueImports.join(', ')} } from '../../demo-values.ts'`]
      : []),
    ...(surfaceUses(surface, 'datasetBindings') ? ['import { datasetViews } from \'../../data/datasets.ts\''] : []),
    ...(surfaceUses(surface, 'resourceBindings') ? ['import { resources } from \'../../data/resources.ts\''] : []),
  ]
  const configContext = !hasContext
    ? ''
    : `export interface SurfaceConfigContext {
  ${interactions.length > 0 ? 'actions: ConfigBindingActions\n  validation: ConfigBindingValidation\n  ' : ''}values: { value: Record<string, unknown> }
  parameters: { readonly value: Readonly<Record<string, unknown>> }
}

`
  const setDemoFieldsBody = valueRules.length > 0
    ? `const candidateValues = { ...values.value, ...structuredClone(patch) }
    try {
      const settledValues = ${valueSettlementFunctionName(surface, context)}(committedValues, candidateValues, changedNodeIds, parameters.value)
      values.value = settledValues
      committedValues = structuredClone(settledValues)
    }
    catch (error) {
      values.value = structuredClone(committedValues)
      throw error
    }`
    : 'values.value = { ...values.value, ...structuredClone(patch) }'
  const valueHandlerSource = [...valueHandlers].map(([nodeId, handlerName]) => (
    `  function ${handlerName}(): void {\n    setDemoFields({}, [${sourceString(nodeId)}])\n  }`
  )).join('\n\n')
  const projectionStates = stateRules.length > 0
    ? `${stateProjectionFunctionName(surface, context)}(values.value, parameters.value).states`
    : '{}'
  const interactionSource = !hasContext
    ? ''
    : `  const { ${interactions.length > 0 ? 'actions, validation, ' : ''}parameters, values } = context
  ${valueRules.length > 0 ? 'let committedValues = structuredClone(values.value)\n' : ''}

${interactionUtilitiesSource('values.value', setDemoFieldsBody).split('\n').map(line => `  ${line}`).join('\n')}

${interactionHandlersSource(
  surface,
  context,
  'values.value',
  projectionStates,
  'actions',
  interactions.length > 0 ? 'validation' : undefined,
).split('\n').map(line => `  ${line}`).join('\n')}

${valueHandlerSource}

`
  const projectionExport = stateRules.length > 0
    ? `export function createReactionProjection(
  values: Readonly<Record<string, unknown>>,
  parameters: Readonly<Record<string, unknown>>,
) {
  return ${stateProjectionFunctionName(surface, context)}(values, parameters)
}

`
    : ''
  const validationDeclarations = compiledValidationSource(surface, context)
  return `${imports.join('\n')}${imports.length ? '\n\n' : ''}${validationDeclarations}${validationDeclarations ? '\n\n' : ''}export const initialModel = ${sourceJson(surfaceInitialModel(surface))}

${projectionExport}${configContext}export function createFields(${hasContext ? 'context: SurfaceConfigContext' : ''}) {
${interactionSource}  return [
${surface.rootIds.map(nodeId => configNodeSource(surface, nodeId, context, interactions, 2)).join('\n')}
  ]
}

export const formConfig = ${sourceJson(surface.form)}
`
}

function bindingSurfaceSource(surface: SourceSurface, context: BindingEmitContext): string {
  assertSupportedInteractionScopes(surface)
  const interactions = emittedInteractions(surface, context)
  const stateRules = stateInteractions(surface)
  const valueRules = valueInteractions(surface)
  const hasContext = interactions.length > 0 || valueRules.length > 0
  return `<script setup lang="ts">
${interactions.length > 0 ? 'import type { ConfigBindingActions, ConfigBindingValidation } from \'../../host.ts\'\n' : ''}import { computed, shallowRef } from 'vue'
import { ${context.binding.component.importName} } from ${sourceString(context.binding.component.moduleSpecifier)}
import { ${context.binding.model.importName} } from ${sourceString(context.binding.model.moduleSpecifier)}
import { ${stateRules.length > 0 ? 'createReactionProjection, ' : ''}createFields, formConfig, initialModel } from './config.ts'

const surfaceProps = defineProps<{
  demoParameters?: Readonly<Record<string, unknown>>
  ${interactions.length > 0 ? 'actions: ConfigBindingActions\n  ' : ''}}>()
const parameters = computed<Record<string, unknown>>(() => ({
  ...${sourceJson(surfaceParameterDefaults(surface))},
  ...(surfaceProps.demoParameters ?? {}),
}))

const values = shallowRef<Record<string, unknown>>(structuredClone(initialModel))
const model = ${context.binding.model.importName}(values)

${interactions.length > 0
  ? `interface ConfigBindingFormExpose {
  validate: () => Promise<boolean>
  listFieldInstances: (nodeId?: string) => readonly {
    address: { nodeId: string, scope: readonly { scopeId: string, rowId: string }[] }
  }[]
  validateInstance: (
    address: { nodeId: string, scope: readonly { scopeId: string, rowId: string }[] },
  ) => Promise<boolean>
}

const formRef = shallowRef<ConfigBindingFormExpose>()
const validation: ConfigBindingValidation = {
  async validate(request) {
    const form = formRef.value
    if (!form || request.surfaceId !== ${sourceString(surface.id)})
      return false
    if (request.scope === 'surface')
      return form.validate()
    if (request.fieldIds.length === 0)
      return false
    for (const nodeId of request.fieldIds) {
      const instances = form.listFieldInstances(nodeId)
      if (instances.length === 0)
        return false
      for (const instance of instances) {
        if (!(await form.validateInstance(instance.address)))
          return false
      }
    }
    return true
  },
}

`
  : ''}const fields = createFields(${hasContext ? `{ ${interactions.length > 0 ? 'actions: surfaceProps.actions, validation, ' : ''}parameters, values }` : ''})
${stateRules.length > 0 ? 'const reactionProjection = computed(() => createReactionProjection(values.value, parameters.value))\n' : ''}
</script>

<template>
  <section class="demo-surface" data-surface-id="${escapeHtml(surface.id)}" data-surface-kind="${surface.kind}">
    <header class="demo-surface__header">
      <h1>${escapeHtml(surface.name)}</h1>
    </header>
    <${context.binding.component.importName}
      ${interactions.length > 0 ? 'ref="formRef"' : ''}
      v-bind="formConfig"
      :fields="fields"
      :model="model"
      ${stateRules.length > 0 ? ':reaction-projection="reactionProjection"' : ''}
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
  const homeRedirect = homeRoute === '/'
    ? []
    : [`    { path: '/', redirect: ${sourceString(homeRoute)} },`]
  return `import { createRouter, createWebHistory } from 'vue-router'
${imports.join('\n')}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
${homeRedirect.join('\n')}
${routes.join('\n')}
  ],
})
`
}

const demoValuesSource = `function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDemoJsonValue(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (typeof value !== 'object' || seen.has(value))
    return false
  seen.add(value)
  return Array.isArray(value)
    ? value.every(item => isDemoJsonValue(item, seen))
    : Object.values(value).every(item => isDemoJsonValue(item, seen))
}

export function readDemoPath(source: unknown, path: readonly string[]): unknown {
  let current = source
  for (const segment of path) {
    if (!isRecord(current) || !Object.hasOwn(current, segment))
      return undefined
    current = current[segment]
  }
  return isDemoJsonValue(current) ? structuredClone(current) : undefined
}

export function requireDemoValue(value: unknown, operation: string): unknown {
  if (value === undefined)
    throw new Error(\`Demo expression \${operation} cannot consume a missing value.\`)
  return value
}

export function requireDemoBoolean(value: unknown, operation: string): boolean {
  const present = requireDemoValue(value, operation)
  if (typeof present !== 'boolean')
    throw new Error(\`Demo expression \${operation} requires a boolean.\`)
  return present
}

export function requireDemoNumber(value: unknown, operation: string): number {
  const present = requireDemoValue(value, operation)
  if (typeof present !== 'number' || !Number.isFinite(present))
    throw new Error(\`Demo expression \${operation} requires a finite number.\`)
  return present
}

export function requireDemoString(value: unknown, operation: string): string {
  const present = requireDemoValue(value, operation)
  if (typeof present !== 'string')
    throw new Error(\`Demo expression \${operation} requires a string.\`)
  return present
}

export function demoValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => demoValuesEqual(item, right[index]))
  }
  if (!isRecord(left) || !isRecord(right))
    return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && demoValuesEqual(left[key], right[key]))
}

export function compareDemoValues(left: unknown, right: unknown, operator: '>' | '>=' | '<' | '<='): boolean {
  const leftValue = requireDemoValue(left, operator)
  const rightValue = requireDemoValue(right, operator)
  if ((typeof leftValue !== 'number' || typeof rightValue !== 'number')
    && (typeof leftValue !== 'string' || typeof rightValue !== 'string')) {
    throw new Error(\`Demo expression \${operator} requires two numbers or two strings.\`)
  }
  if (operator === '>')
    return leftValue > rightValue
  if (operator === '>=')
    return leftValue >= rightValue
  if (operator === '<')
    return leftValue < rightValue
  return leftValue <= rightValue
}

export function calculateDemoNumber(left: unknown, right: unknown, operator: '+' | '-' | '*' | '/' | '%'): number {
  const leftValue = requireDemoNumber(left, operator)
  const rightValue = requireDemoNumber(right, operator)
  if ((operator === '/' || operator === '%') && rightValue === 0)
    throw new Error(\`Demo expression \${operator} cannot divide by zero.\`)
  const result = operator === '+'
    ? leftValue + rightValue
    : operator === '-'
      ? leftValue - rightValue
      : operator === '*'
        ? leftValue * rightValue
        : operator === '/'
          ? leftValue / rightValue
          : leftValue % rightValue
  if (!Number.isFinite(result))
    throw new Error(\`Demo expression \${operator} produced a non-finite result.\`)
  return result
}

export function demoLength(value: unknown): number {
  const present = requireDemoValue(value, 'length')
  if (typeof present !== 'string' && !Array.isArray(present))
    throw new Error('Demo expression length requires a string or array.')
  return present.length
}

export function demoIncludes(value: unknown, search: unknown): boolean {
  const present = requireDemoValue(value, 'includes')
  const searched = requireDemoValue(search, 'includes')
  if (typeof present === 'string')
    return present.includes(requireDemoString(searched, 'includes'))
  if (Array.isArray(present))
    return present.some(item => demoValuesEqual(item, searched))
  throw new Error('Demo expression includes requires string/string or array/JSON-value.')
}

export interface DemoReactionProjection {
  states: Record<string, Partial<Record<'visible' | 'disabled' | 'readonly' | 'required', boolean>>>
  props: Record<string, Record<string, unknown>>
}

export function writeDemoPath(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  let current = target
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      current[segment] = structuredClone(requireDemoValue(value, 'property projection'))
      return
    }
    const existing = current[segment]
    if (isRecord(existing)) {
      current = existing
      return
    }
    const nested: Record<string, unknown> = {}
    current[segment] = nested
    current = nested
  })
}

function mergeDemoRecords(
  target: Record<string, unknown>,
  patch: Readonly<Record<string, unknown>>,
): void {
  Object.entries(patch).forEach(([key, value]) => {
    if (isRecord(value) && isRecord(target[key])) {
      mergeDemoRecords(target[key], value)
      return
    }
    target[key] = structuredClone(value)
  })
}

export function mergeDemoNodeProps(
  baseline: Readonly<Record<string, unknown>>,
  projected: Readonly<Record<string, unknown>> | undefined,
  state: DemoReactionProjection['states'][string] | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = structuredClone({ ...baseline })
  if (projected)
    mergeDemoRecords(result, projected)
  for (const key of ['disabled', 'readonly', 'required'] as const) {
    if (state?.[key] !== undefined)
      result[key] = state[key]
  }
  if (state?.required !== undefined)
    result['aria-required'] = state.required ? 'true' : 'false'
  return result
}

export function demoRecordValueChanged(
  previous: Readonly<Record<string, unknown>>,
  candidate: Readonly<Record<string, unknown>>,
  field: string,
): boolean {
  const previousHas = Object.hasOwn(previous, field)
  const candidateHas = Object.hasOwn(candidate, field)
  return previousHas !== candidateHas || !demoValuesEqual(previous[field], candidate[field])
}
`

function demoNavigationSource(compilation: ProjectCompilation): string {
  const pageRoutes = Object.fromEntries(compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    return surface?.kind === 'page' ? [[surface.id, surface.route]] : []
  }))
  return `import type { InjectionKey, ShallowRef } from 'vue'
import type { HistoryState, Router } from 'vue-router'
import { inject, provide, shallowReactive, shallowRef } from 'vue'

const demoPageRoutes: Readonly<Record<string, string>> = ${sourceJson(pageRoutes, 0)}
const demoHomeSurfaceId = ${sourceString(compilation.ir.homeSurfaceId)}

export interface DemoSurfaceResult {
  name: string
  value: unknown
}

export interface DemoPageEntry {
  instanceId: string
  surfaceId: string
  route: string
  parameters: Readonly<Record<string, unknown>>
}

export interface DemoOverlayEntry {
  instanceId: string
  surfaceId: string
  parameters: Readonly<Record<string, unknown>>
}

export interface DemoNavigation {
  overlays: readonly DemoOverlayEntry[]
  pageHistory: readonly DemoPageEntry[]
  currentPage: ShallowRef<DemoPageEntry>
  navigate: (surfaceId: string, parameters?: Readonly<Record<string, unknown>>) => Promise<void>
  back: () => void
  open: (
    surfaceId: string,
    parameters?: Readonly<Record<string, unknown>>,
    complete?: (result: DemoSurfaceResult) => void,
  ) => void
  closeCurrent: (result?: DemoSurfaceResult) => void
  closeAll: () => void
}

const demoNavigationKey: InjectionKey<DemoNavigation> = Symbol('demo-navigation')

function readHistoryPage(value: unknown): DemoPageEntry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined
  const entry = value as Partial<DemoPageEntry>
  if (typeof entry.instanceId !== 'string' || typeof entry.surfaceId !== 'string'
    || typeof entry.route !== 'string' || !entry.parameters || typeof entry.parameters !== 'object'
    || Array.isArray(entry.parameters) || demoPageRoutes[entry.surfaceId] !== entry.route) {
    return undefined
  }
  return {
    instanceId: entry.instanceId,
    surfaceId: entry.surfaceId,
    route: entry.route,
    parameters: structuredClone(entry.parameters),
  }
}

export function createDemoNavigation(router: Pick<Router, 'push' | 'back' | 'afterEach'>): DemoNavigation {
  const overlays = shallowReactive<DemoOverlayEntry[]>([])
  const pageHistory = shallowReactive<DemoPageEntry[]>([])
  const completions = new Map<string, (result: DemoSurfaceResult) => void>()
  const openers = new Map<string, HTMLElement>()
  let nextInstance = 1

  function createPageEntry(
    surfaceId: string,
    parameters: Readonly<Record<string, unknown>>,
  ): DemoPageEntry {
    const route = demoPageRoutes[surfaceId]
    if (!route)
      throw new Error(\`Unknown demo page: \${surfaceId}\`)
    const entry = {
      instanceId: \`\${surfaceId}-page-\${nextInstance}\`,
      surfaceId,
      route,
      parameters: structuredClone(parameters),
    }
    nextInstance += 1
    return entry
  }

  function publishPage(entry: DemoPageEntry): void {
    const existingIndex = pageHistory.findIndex(item => item.instanceId === entry.instanceId)
    if (existingIndex >= 0)
      pageHistory.splice(existingIndex + 1)
    else
      pageHistory.push(entry)
    currentPage.value = pageHistory.at(-1)!
  }

  const initialPage = createPageEntry(demoHomeSurfaceId, {})
  pageHistory.push(initialPage)
  const currentPage = shallowRef(initialPage)

  router.afterEach((to) => {
    if (typeof window === 'undefined')
      return
    const state = window.history.state as { demoPage?: unknown } | null
    const restored = readHistoryPage(state?.demoPage)
    if (restored) {
      publishPage(restored)
      return
    }
    if (typeof to.name !== 'string' || !demoPageRoutes[to.name])
      return
    const entry = currentPage.value.surfaceId === to.name && pageHistory.length === 1
      ? currentPage.value
      : createPageEntry(to.name, {})
    pageHistory.splice(0, pageHistory.length, entry)
    currentPage.value = entry
    window.history.replaceState({ ...window.history.state, demoPage: entry }, '')
  })

  async function navigate(surfaceId: string, parameters: Readonly<Record<string, unknown>> = {}): Promise<void> {
    const entry = createPageEntry(surfaceId, parameters)
    overlays.splice(0)
    completions.clear()
    openers.clear()
    await router.push({
      path: entry.route,
      force: true,
      state: { demoPage: entry } as unknown as HistoryState,
    })
    publishPage(entry)
  }

  function restoreFocus(opener: HTMLElement | undefined): void {
    if (!opener)
      return
    queueMicrotask(() => {
      if (opener.isConnected)
        opener.focus()
    })
  }

  function closeCurrent(result?: DemoSurfaceResult): void {
    const current = overlays.pop()
    if (!current)
      return
    const complete = completions.get(current.instanceId)
    const opener = openers.get(current.instanceId)
    completions.delete(current.instanceId)
    openers.delete(current.instanceId)
    if (result && complete)
      complete(structuredClone(result))
    restoreFocus(opener)
  }

  return {
    overlays,
    pageHistory,
    currentPage,
    navigate,
    back() {
      if (overlays.length > 0)
        closeCurrent()
      else if (pageHistory.length > 1) {
        pageHistory.pop()
        currentPage.value = pageHistory.at(-1)!
        router.back()
      }
    },
    open(surfaceId, parameters = {}, complete) {
      const instanceId = \`\${surfaceId}-\${nextInstance}\`
      overlays.push({
        instanceId,
        surfaceId,
        parameters: structuredClone(parameters),
      })
      if (complete)
        completions.set(instanceId, complete)
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement)
        openers.set(instanceId, document.activeElement)
      nextInstance += 1
    },
    closeCurrent,
    closeAll() {
      const opener = overlays.length > 0 ? openers.get(overlays[0]!.instanceId) : undefined
      overlays.splice(0)
      completions.clear()
      openers.clear()
      restoreFocus(opener)
    },
  }
}

export function provideDemoNavigation(navigation: DemoNavigation): void {
  provide(demoNavigationKey, navigation)
}

export function useDemoNavigation(): DemoNavigation {
  const navigation = inject(demoNavigationKey)
  if (!navigation)
    throw new Error('Demo navigation is not available.')
  return navigation
}
`
}

function controlledLengthSource(length: { value: number, unit: string }): string {
  return `${length.value}${length.unit}`
}

function overlaySource(surface: Exclude<SourceSurface, { kind: 'page' }>, componentName: string): string {
  const presentation = surface.presentation
  const size = presentation.kind === 'dialog' ? presentation.width.desktop : presentation.size.desktop
  const maskClass = presentation.mask ? '' : ' demo-overlay--unmasked'
  const panelClass = presentation.kind === 'dialog'
    ? 'demo-overlay__panel demo-overlay__panel--dialog'
    : `demo-overlay__panel demo-overlay__panel--drawer demo-overlay__panel--drawer-${presentation.placement}`
  return `    <dialog
      v-if="overlay.surfaceId === ${sourceAttributeString(surface.id)}"
      class="demo-overlay${maskClass}"
      :ref="element => registerOverlayDialog(overlay.instanceId, element)"
      :data-overlay-instance="overlay.instanceId"
      :aria-labelledby="${sourceAttributeString(`demo-overlay-title-${surface.id}-`)} + overlay.instanceId"
      @click.self="dismissOverlay(overlay.instanceId, ${presentation.close.mask})"
      @cancel="handleOverlayCancel($event, overlay.instanceId, ${presentation.close.escape})"
      @close="handleOverlayClose(overlay.instanceId)"
    >
      <section
        class="${panelClass}"
        :style="{ '--demo-overlay-size': ${sourceAttributeString(controlledLengthSource(size))} }"
      >
        <header class="demo-overlay__heading">
          <h2 :id="${sourceAttributeString(`demo-overlay-title-${surface.id}-`)} + overlay.instanceId">${escapeHtml(presentation.title)}</h2>
          ${presentation.close.button ? `<button type="button" class="demo-overlay__close" aria-label="Close ${escapeHtml(presentation.title)}" @click="dismissOverlay(overlay.instanceId, true)">&times;</button>` : ''}
        </header>
        <${componentName} :demo-parameters="overlay.parameters" />
      </section>
    </dialog>`
}

function appSource(context: EmitContext): string {
  const { compilation, surfaceDirectories: directories } = context
  const overlays = compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    return surface && surface.kind !== 'page' ? [surface] : []
  })
  const usesNavigation = overlays.length > 0 || compilation.ir.surfaceOrder.some((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    return surface ? emittedInteractions(surface, context).length > 0 : false
  })
  if (!usesNavigation) {
    return `<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
`
  }
  const componentNames = new Map(overlays.map((surface, index) => [surface.id, `OverlaySurface${index + 1}`]))
  const overlayImports = overlays.map(surface => (
    `import ${componentNames.get(surface.id)} from './surfaces/${directories.get(surface.id)}/Surface.vue'`
  ))
  const renderedOverlays = overlays.map(surface => overlaySource(surface, componentNames.get(surface.id)!)).join('\n')
  return `<script setup lang="ts">
import { nextTick } from 'vue'
import { RouterView } from 'vue-router'
import { createDemoNavigation, provideDemoNavigation } from './demo-navigation'
import { router } from './router'
${overlayImports.join('\n')}

const navigation = createDemoNavigation(router)
const { currentPage, overlays } = navigation
const overlayDialogs = new Map<string, HTMLDialogElement>()
provideDemoNavigation(navigation)

function registerOverlayDialog(instanceId: string, element: unknown): void {
  if (!(element instanceof HTMLDialogElement)) {
    overlayDialogs.delete(instanceId)
    return
  }
  overlayDialogs.set(instanceId, element)
  void nextTick(() => {
    if (overlayDialogs.get(instanceId) === element && element.isConnected && !element.open)
      element.showModal()
  })
}

function dismissOverlay(instanceId: string, allowed: boolean): void {
  if (allowed && overlays.at(-1)?.instanceId === instanceId)
    navigation.closeCurrent()
}

function handleOverlayCancel(event: Event, instanceId: string, allowed: boolean): void {
  event.preventDefault()
  dismissOverlay(instanceId, allowed)
}

function handleOverlayClose(instanceId: string): void {
  if (overlays.at(-1)?.instanceId === instanceId)
    navigation.closeCurrent()
}
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" :key="currentPage.instanceId" :demo-parameters="currentPage.parameters" />
  </RouterView>
  <Teleport to="body">
    <template v-for="overlay in overlays" :key="overlay.instanceId">
${renderedOverlays}
    </template>
  </Teleport>
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

function sourceSurfaces(context: EmitContext): SourceSurface[] {
  return context.compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = context.compilation.ir.surfacesById[surfaceId]
    return surface ? [surface] : []
  })
}

function demoValueFiles(context: EmitContext): SourceTextFile[] {
  const surfaces = sourceSurfaces(context)
  const needsDemoValues = surfaces.some(surface => (
    stateInteractions(surface).length > 0
    || valueInteractions(surface).length > 0
    || emittedInteractions(surface, context).some(interaction => interactionExpressions(interaction.binding).length > 0)
  ))
  if (!needsDemoValues)
    return []
  const interactionFunctions = surfaces
    .map(surface => surfaceInteractionFunctionsSource(surface, context))
    .filter(Boolean)
    .join('\n\n')
  return [textFile('src/demo-values.ts', 'typescript', `${demoValuesSource}\n${interactionFunctions}`)]
}

function rawCommonFiles(context: EmitContext): SourceTextFile[] {
  const { compilation } = context
  const surfaces = sourceSurfaces(context)
  const needsDemoNavigation = surfaces.some(surface => surface.kind !== 'page' || emittedInteractions(surface, context).length > 0)
  return [
    textFile('index.html', 'text', htmlSource(compilation.ir.name)),
    textFile('src/App.vue', 'vue', appSource(context)),
    textFile('src/data/datasets.ts', 'typescript', datasetsSource(compilation)),
    textFile('src/data/resources.ts', 'typescript', resourcesSource(context.resources)),
    ...(needsDemoNavigation ? [textFile('src/demo-navigation.ts', 'typescript', demoNavigationSource(compilation))] : []),
    ...demoValueFiles(context),
    textFile('src/router.ts', 'typescript', routerSource(compilation, context.surfaceDirectories)),
    textFile('src/styles.css', 'css', projectStyles),
    textFile('src/theme.css', 'css', themeSource(compilation.ir.theme as ProjectTheme)),
    textFile('tsconfig.json', 'json', tsconfig),
    textFile('vite.config.ts', 'typescript', viteConfig),
  ]
}

function bindingCommonFiles(context: BindingEmitContext): SourceTextFile[] {
  const { compilation } = context
  return [
    textFile('src/bindings.ts', 'typescript', bindingEntrySource(context)),
    textFile('src/data/datasets.ts', 'typescript', datasetsSource(compilation)),
    textFile('src/data/resources.ts', 'typescript', resourcesSource(context.resources)),
    ...demoValueFiles(context),
    textFile('src/host.ts', 'typescript', bindingHostSource),
    textFile('src/theme.css', 'css', themeSource(compilation.ir.theme as ProjectTheme)),
    textFile('tsconfig.json', 'json', tsconfig),
    textFile('vite.config.ts', 'typescript', bindingViteConfig),
  ]
}

function assemble<T extends RawSourceFileSetV1 | ConfigBindingFileSetV1>(
  kind: T['kind'],
  entry: string,
  files: readonly SourceFile[],
): T {
  const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path))
  const result = readSourceFileSet({ version: 1, kind, entry, files: sorted })
  if (!result.success)
    throw new Error(result.diagnostics.map(item => item.message).join('; '))
  return result.data as T
}

export function emitRawProject(
  compilation: ProjectCompilation,
  components: ReadonlyMap<string, SourceComponentResolution>,
  dependencies: Readonly<Record<string, string>>,
  resources: CollectedSourceResources,
  validation: SourceValidationEmissionPlan,
): RawSourceFileSetV1 {
  const surfaceDirectories = uniqueSlugs(compilation.ir.surfaceOrder)
  const context: EmitContext = { compilation, components, resources, surfaceDirectories, validation }
  const surfaceFiles = compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      return []
    const directory = surfaceDirectories.get(surfaceId)
    return [
      textFile(`src/surfaces/${directory}/Surface.vue`, 'vue', rawSurfaceSource(surface, context)),
      textFile(
        `src/surfaces/${directory}/validation.ts`,
        'typescript',
        rawValidationModuleSource(surface, validationFields(surface, context)),
      ),
    ]
  })
  return assemble('raw-source', 'src/main.ts', [
    ...rawCommonFiles(context),
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
  validation: SourceValidationEmissionPlan,
): ConfigBindingFileSetV1 {
  const surfaceDirectories = uniqueSlugs(compilation.ir.surfaceOrder)
  const context: BindingEmitContext = { compilation, components, resources, surfaceDirectories, binding, validation }
  const surfaceFiles = compilation.ir.surfaceOrder.flatMap((surfaceId) => {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface)
      return []
    const directory = surfaceDirectories.get(surfaceId)
    return [
      textFile(`src/surfaces/${directory}/Surface.vue`, 'vue', bindingSurfaceSource(surface, context)),
      textFile(`src/surfaces/${directory}/config.ts`, 'typescript', bindingConfigSource(surface, context)),
    ]
  })
  return assemble('config-bindings', 'src/bindings.ts', [
    ...bindingCommonFiles(context),
    ...surfaceFiles,
    ...resources.files,
    textFile('package.json', 'json', packageManifest(compilation.ir.name, {
      ...binding.dependencies,
      ...bindingValidationDependencies(context),
    }, false)),
  ])
}
