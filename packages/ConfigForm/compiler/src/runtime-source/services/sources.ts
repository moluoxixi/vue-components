const CORE_SOURCE_PREFIX = '../../../../core/src/'
const HEADLESS_SOURCE_PREFIX = '../../../../headless/src/'
const VUE_SOURCE_PREFIX = '../../../../runtime/src/'

const coreSources = import.meta.glob<string>([
  '../../../../core/src/**/*.ts',
  '!**/__tests__/**',
], { eager: true, import: 'default', query: '?raw' })

const headlessSources = import.meta.glob<string>([
  '../../../../headless/src/**/*.ts',
  '!**/__tests__/**',
], { eager: true, import: 'default', query: '?raw' })

const vueSources = import.meta.glob<string>([
  '../../../../runtime/src/**/*.ts',
  '../../../../runtime/src/**/*.vue',
  '../../../../runtime/src/**/*.scss',
  '!**/__tests__/**',
], { eager: true, import: 'default', query: '?raw' })

const WORKSPACE_TARGETS: Readonly<Record<string, string>> = Object.freeze({
  '@moluoxixi/config-form': 'vue',
  '@moluoxixi/config-form-core': 'core',
  '@moluoxixi/config-form-headless': 'headless',
})

const coreEntry = `export * from './data-source'
export * from './expression'
export * from './field'
export * from './json'
export * from './layout'
export * from './module-registry'
export * from './reaction'
export * from './value-reference'
export * from './value-scope'
`

const headlessEntry = `export * from './registries'
export * from './schemas'
export * from './services'
export type * from './types'
export * from './utils'
`

const vueEntry = `export { ConfigForm } from './components'
export type { ConfigFormProps } from './components/ConfigForm'
export { ConfigFormError } from './errors'
export * from './renderer'
export type {
  ConfigFormRendererEmits as ConfigFormEmits,
  ConfigFormRendererExpose as ConfigFormExpose,
} from './renderer'
export type {
  ComponentRegistry,
  ConfigFormComponentRegistration,
  ConfigFormSurfaceRuntimeOptionBinding,
  ConfigFormSurfaceRuntimePlan,
  ConfigFormSurfaceRuntimeValueSchema,
  FormRuntimeOptions,
  ReadonlyAdapter,
  ReadonlyAdapterRegistry,
  ReadonlyRenderContext,
} from './runtime'
export type {
  AdaptedVueFunctionalComponent,
  FieldCondition,
  FieldConfig,
  FieldKey,
  FieldSchema,
  FieldValidator,
  FieldValidatorResult,
  FormErrors,
  FormNodeConfig,
  FormValues,
  NormalizedFieldConfig,
  RenderContext,
  RenderFunction,
  RenderSlotInvoker,
  ResolvedBoundNode,
  ResolvedComponentField,
  ResolvedComponentNode,
  ResolvedField,
  ResolvedFormNode,
  ResolvedSlotContent,
  RuntimeText,
  SlotContent,
  ValidateTrigger,
} from './types'
export { asVueFunctionalComponent, defineField, defineFields } from './utils'
`

function relativeModuleSpecifier(fromPath: string, targetPath: string): string {
  const from = fromPath.split('/').slice(0, -1)
  const target = targetPath.split('/')
  let shared = 0
  while (shared < from.length && shared < target.length && from[shared] === target[shared])
    shared += 1
  const value = [
    ...Array.from({ length: from.length - shared }).fill('..'),
    ...target.slice(shared),
  ].join('/')
  return value.startsWith('.') ? value : `./${value}`
}

function rewriteWorkspaceImports(path: string, source: string): string {
  let rewritten = source
  for (const [packageName, target] of Object.entries(WORKSPACE_TARGETS)) {
    const specifier = relativeModuleSpecifier(path, target)
    rewritten = rewritten
      .replaceAll(`'${packageName}'`, `'${specifier}'`)
      .replaceAll(`"${packageName}"`, `"${specifier}"`)
  }
  return rewritten
}

function sourceEntries(
  entries: Record<string, string>,
  prefix: string,
  outputPrefix = '',
): Array<[string, string]> {
  return Object.entries(entries).map(([path, source]) => {
    const outputPath = `${outputPrefix}${path.slice(prefix.length)}`
    return [outputPath, rewriteWorkspaceImports(outputPath, source)]
  })
}

/** Package the actual Core, Headless and Vue renderer sources as one local import closure. */
export function getConfigFormRuntimeSources(): Readonly<Record<string, string>> {
  const entries: Array<[string, string]> = [
    ['core.ts', coreEntry],
    ...sourceEntries(coreSources, CORE_SOURCE_PREFIX),
    ['headless/index.ts', headlessEntry],
    ...sourceEntries(headlessSources, HEADLESS_SOURCE_PREFIX, 'headless/'),
    ['vue/index.ts', vueEntry],
    ...sourceEntries(vueSources, VUE_SOURCE_PREFIX, 'vue/'),
  ]
  return Object.freeze(Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right))))
}
