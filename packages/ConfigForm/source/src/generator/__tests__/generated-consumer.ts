import type { SourceFileSetV1, SourceTextFile } from '../types'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const execFileAsync = promisify(execFile)
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url))
const workspaceRoot = resolve(packageRoot, '../../..')
const require = createRequire(import.meta.url)
const vueTscBin = require.resolve('vue-tsc/bin/vue-tsc.js')
const viteBin = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')

function installedPackagePath(name: string, fallback: string): string {
  const direct = join(packageRoot, 'node_modules', ...name.split('/'))
  return existsSync(direct) ? direct : fallback
}

const internalConsumerDependencies = new Map<string, string>([
  ['@moluoxixi/config-form', resolve(workspaceRoot, 'packages/ConfigForm/runtime')],
  ['@moluoxixi/config-form-element', resolve(workspaceRoot, 'packages/ConfigForm/element')],
  ['@moluoxixi/config-form-headless', resolve(workspaceRoot, 'packages/ConfigForm/headless')],
  ['@moluoxixi/zod3-to-rule', resolve(workspaceRoot, 'packages/zod3-to-rule')],
])

const externalConsumerDependencies = new Map<string, string>([
  ['@vitejs/plugin-vue', join(packageRoot, 'node_modules/@vitejs/plugin-vue')],
  ['ant-design-vue', installedPackagePath('ant-design-vue', resolve(workspaceRoot, 'packages/ConfigForm/designer-antd-vue/node_modules/ant-design-vue'))],
  ['element-plus', installedPackagePath('element-plus', resolve(workspaceRoot, 'packages/ConfigForm/element/node_modules/element-plus'))],
  ['sass', join(packageRoot, 'node_modules/sass')],
  ['vite', join(packageRoot, 'node_modules/vite')],
  ['vue', join(packageRoot, 'node_modules/vue')],
  ['vue-router', installedPackagePath('vue-router', resolve(workspaceRoot, 'packages/ConfigForm/workbench/node_modules/vue-router'))],
  ['zod', installedPackagePath('zod', resolve(workspaceRoot, 'packages/ConfigForm/element/node_modules/zod'))],
])

function packageNameFromSpecifier(specifier: string): string | undefined {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/'))
    return undefined
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function isForbiddenRawPackage(name: string): boolean {
  return name.startsWith('@moluoxixi/')
    || name.startsWith('@config-form/')
    || name === 'zod'
    || name.startsWith('zod/')
}

function moduleSpecifiers(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const specifiers: string[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]!)) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

function generatedModuleSpecifiers(file: SourceTextFile): string[] {
  if (file.path.endsWith('.vue')) {
    const descriptor = parse(file.content, { filename: file.path }).descriptor
    return [descriptor.script, descriptor.scriptSetup].flatMap(block => (
      block ? moduleSpecifiers(block.content, file.path) : []
    ))
  }
  return /\.(?:[cm]?[jt]s|tsx?)$/u.test(file.path)
    ? moduleSpecifiers(file.content, file.path)
    : []
}

function textFiles(fileSet: SourceFileSetV1): SourceTextFile[] {
  return fileSet.files.filter((file): file is SourceTextFile => file.kind === 'text')
}

interface GeneratedPackageManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function manifestDependencyNames(manifest: GeneratedPackageManifest): string[] {
  return [...new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ])]
}

function formatCompilerErrors(errors: readonly (string | SyntaxError)[]): string {
  return errors.map(error => typeof error === 'string' ? error : error.message).join('\n')
}

export function assertGeneratedVueFilesCompile(fileSet: SourceFileSetV1): void {
  for (const file of textFiles(fileSet).filter(file => file.path.endsWith('.vue'))) {
    const parsed = parse(file.content, { filename: file.path })
    if (parsed.errors.length > 0)
      throw new Error(`${file.path} failed SFC parsing:\n${formatCompilerErrors(parsed.errors)}`)

    const { descriptor } = parsed
    let bindingMetadata: ReturnType<typeof compileScript>['bindings'] | undefined
    if (descriptor.script || descriptor.scriptSetup) {
      const compiledScript = compileScript(descriptor, {
        id: `generated-${file.path.replace(/[^a-z0-9]/gi, '-')}`,
      })
      bindingMetadata = compiledScript.bindings
    }
    if (descriptor.template) {
      const compiledTemplate = compileTemplate({
        id: `generated-${file.path.replace(/[^a-z0-9]/gi, '-')}`,
        filename: file.path,
        source: descriptor.template.content,
        compilerOptions: { bindingMetadata },
      })
      if (compiledTemplate.errors.length > 0) {
        throw new Error(
          `${file.path} failed template compilation:\n${formatCompilerErrors(compiledTemplate.errors)}`,
        )
      }
    }
  }
}

export function assertGeneratedRuntimeBoundary(fileSet: SourceFileSetV1): void {
  const forbiddenDirectories = [
    'src/compiler/',
    'src/prototype-runtime/',
    'src/runtime/',
    'src/session/',
  ]
  const forbiddenSymbols = [
    /@moluoxixi\/config-form-compiler/iu,
    /@moluoxixi\/config-form-prototype-runtime/iu,
    /handler\s*registry/iu,
    /initializePrototypeSession/u,
    /overlay\s*host/iu,
    /reducePrototypeSession/u,
    /session\s*reducer/iu,
  ]

  for (const file of fileSet.files) {
    if (forbiddenDirectories.some(prefix => file.path.startsWith(prefix)))
      throw new Error(`${fileSet.kind} emitted forbidden runtime path ${file.path}.`)
  }

  if (fileSet.kind === 'config-bindings') {
    const forbiddenBindingPaths = new Set([
      'index.html',
      'src/App.vue',
      'src/demo-navigation.ts',
      'src/main.ts',
      'src/router.ts',
      'src/styles.css',
    ])
    const emittedForbiddenPath = fileSet.files.find(file => forbiddenBindingPaths.has(file.path))
    if (emittedForbiddenPath)
      throw new Error(`config-bindings emitted host runtime path ${emittedForbiddenPath.path}.`)
    if (fileSet.entry !== 'src/bindings.ts')
      throw new Error(`config-bindings used unexpected entry ${fileSet.entry}.`)
  }

  const generatedText = textFiles(fileSet).map(file => file.content).join('\n')
  if (fileSet.kind === 'raw-source') {
    const forbiddenImport = textFiles(fileSet)
      .flatMap(file => generatedModuleSpecifiers(file).map(specifier => ({ file: file.path, specifier })))
      .find(({ specifier }) => {
        const packageName = packageNameFromSpecifier(specifier)
        return packageName ? isForbiddenRawPackage(packageName) : false
      })
    if (forbiddenImport) {
      throw new Error(
        `raw-source emitted forbidden import ${forbiddenImport.specifier} in ${forbiddenImport.file}.`,
      )
    }
  }
  for (const forbidden of forbiddenSymbols) {
    if (forbidden.test(generatedText))
      throw new Error(`${fileSet.kind} emitted forbidden runtime source matching ${forbidden}.`)
  }
  if (fileSet.kind === 'config-bindings') {
    const forbiddenBindingSymbols = [
      /createDemoNavigation/u,
      /provideDemoNavigation/u,
      /useDemoNavigation/u,
      /\bnavigation\./u,
      /execute(?:Primary)?UiAction/iu,
    ]
    for (const forbidden of forbiddenBindingSymbols) {
      if (forbidden.test(generatedText))
        throw new Error(`config-bindings emitted host action executor matching ${forbidden}.`)
    }
  }

  const manifestFile = textFiles(fileSet).find(file => file.path === 'package.json')
  if (!manifestFile)
    throw new Error(`${fileSet.kind} did not emit package.json.`)
  const manifest = JSON.parse(manifestFile.content) as GeneratedPackageManifest
  const dependencyNames = Object.keys(manifest.dependencies ?? {})
  const manifestPackageNames = manifestDependencyNames(manifest)
  if (fileSet.kind === 'config-bindings' && dependencyNames.includes('vue-router'))
    throw new Error('config-bindings emitted a vue-router dependency.')
  const forbiddenDependencies = fileSet.kind === 'raw-source'
    ? manifestPackageNames.filter(isForbiddenRawPackage)
    : dependencyNames.filter(name => [
        '@moluoxixi/config-form-compiler',
        '@moluoxixi/config-form-designer',
        '@moluoxixi/config-form-model',
        '@moluoxixi/config-form-prototype-runtime',
        '@moluoxixi/config-form-source',
        '@config-form/workbench',
      ].includes(name))
  if (forbiddenDependencies.length > 0) {
    throw new Error(
      `${fileSet.kind} emitted forbidden dependencies: ${forbiddenDependencies.join(', ')}.`,
    )
  }
  if (fileSet.kind === 'raw-source') {
    const providerDependencies = dependencyNames.filter(name => name !== 'vue' && name !== 'vue-router')
    if (providerDependencies.length > 1) {
      throw new Error(
        `raw-source emitted more than one provider dependency: ${providerDependencies.join(', ')}.`,
      )
    }
    const allowed = new Set(['vue', 'vue-router', ...providerDependencies])
    const unexpected = dependencyNames.filter(name => !allowed.has(name))
    if (unexpected.length > 0)
      throw new Error(`raw-source emitted unexpected runtime dependencies: ${unexpected.join(', ')}.`)

    const sourceImports = textFiles(fileSet)
      .filter(file => file.path.startsWith('src/'))
      .flatMap(file => generatedModuleSpecifiers(file))
      .flatMap((specifier) => {
        const packageName = packageNameFromSpecifier(specifier)
        return packageName ? [packageName] : []
      })
    const unexpectedImports = [...new Set(sourceImports.filter(name => !allowed.has(name)))]
    if (unexpectedImports.length > 0)
      throw new Error(`raw-source emitted unexpected application imports: ${unexpectedImports.join(', ')}.`)
  }
}

async function writeGeneratedFiles(root: string, fileSet: SourceFileSetV1): Promise<void> {
  for (const file of fileSet.files) {
    const target = join(root, ...file.path.split('/'))
    await mkdir(dirname(target), { recursive: true })
    const content = file.kind === 'text'
      ? file.content
      : Buffer.from(file.contentBase64, 'base64')
    await writeFile(target, content)
  }
}

function generatedDependencyNames(fileSet: SourceFileSetV1): string[] {
  const manifestFile = textFiles(fileSet).find(file => file.path === 'package.json')
  if (!manifestFile)
    throw new Error(`${fileSet.kind} did not emit package.json.`)
  const manifest = JSON.parse(manifestFile.content) as GeneratedPackageManifest
  return [...new Set([
    ...manifestDependencyNames(manifest),
    'sass',
  ])]
}

async function linkConsumerDependencies(root: string, fileSet: SourceFileSetV1): Promise<void> {
  for (const name of generatedDependencyNames(fileSet)) {
    if (fileSet.kind === 'raw-source' && isForbiddenRawPackage(name))
      throw new Error(`Raw generated consumer attempted to link internal package ${name}.`)
    const target = externalConsumerDependencies.get(name) ?? internalConsumerDependencies.get(name)
    if (!target)
      continue
    if (!existsSync(target))
      throw new Error(`Generated consumer dependency ${name} is not installed at ${target}.`)
    const linkPath = join(root, 'node_modules', ...name.split('/'))
    await mkdir(dirname(linkPath), { recursive: true })
    await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
  }
}

interface GeneratedDemoNavigation {
  overlays: readonly {
    instanceId: string
    surfaceId: string
    parameters: Readonly<Record<string, unknown>>
  }[]
  pageHistory: readonly {
    instanceId: string
    surfaceId: string
    route: string
    parameters: Readonly<Record<string, unknown>>
  }[]
  currentPage: {
    value: {
      instanceId: string
      surfaceId: string
      route: string
      parameters: Readonly<Record<string, unknown>>
    }
  }
  navigate: (surfaceId: string, parameters?: Readonly<Record<string, unknown>>) => Promise<void>
  back: () => void
  open: (
    surfaceId: string,
    parameters?: Readonly<Record<string, unknown>>,
    complete?: (result: { name: string, value: unknown }) => void,
  ) => void
  closeCurrent: (result?: { name: string, value: unknown }) => void
  closeAll: () => void
}

interface GeneratedBindingActions {
  navigate: (surfaceId: string, parameters: Readonly<Record<string, unknown>>) => void | Promise<void>
  back: () => void
  open: (
    surfaceId: string,
    parameters: Readonly<Record<string, unknown>>,
    complete?: (result: { name: string, value: unknown }) => void,
  ) => void
  closeCurrent: (result?: { name: string, value: unknown }) => void
  closeAll: () => void
}

interface GeneratedBindingValidationRequest {
  surfaceId: string
  scope: 'surface' | 'fields'
  fieldIds: readonly string[]
}

interface GeneratedHomeInteractions {
  projectHomeDemoState: (
    values: Readonly<Record<string, unknown>>,
    parameters: Readonly<Record<string, unknown>>,
  ) => {
    states: Record<string, Record<string, boolean>>
    props: Record<string, Record<string, unknown>>
  }
  settleHomeDemoValues: (
    previousValues: Readonly<Record<string, unknown>>,
    candidateValues: Readonly<Record<string, unknown>>,
    changedNodeIds: readonly string[],
    parameters: Readonly<Record<string, unknown>>,
  ) => Record<string, unknown>
}

const initialInteractionValues = {
  clearable: 'remove me',
  enabled: true,
  guard: 1,
  mirror: 'initial mirror',
  name: 'Ada',
  order: 'initial order',
  status: 'draft',
  summaryValue: 'initial summary',
}

async function verifyGeneratedInteractions(root: string, fileSet: SourceFileSetV1): Promise<void> {
  const valuesUrl = pathToFileURL(join(root, 'src/demo-values.ts')).href
  const generated = await import(`${valuesUrl}?generated-interactions=${Date.now()}`) as GeneratedHomeInteractions
  const initial = structuredClone(initialInteractionValues)
  const projection = generated.projectHomeDemoState(initial, {})
  if (projection.states.name?.required !== true || projection.states.status?.visible !== true)
    throw new Error('Generated state projection did not compute required and visible baselines.')
  if (projection.props.status?.placeholder !== 'Choose status')
    throw new Error('Generated property projection did not preserve its property path.')
  if (initial.summaryValue !== 'initial summary' || initial.mirror !== 'initial mirror' || initial.order !== 'initial order')
    throw new Error('Generated interactions executed value actions during initialization.')

  const candidate = { ...initial, name: 'Lin' }
  const settled = generated.settleHomeDemoValues(initial, candidate, ['name'], {})
  if (settled.summaryValue !== 'LIN' || settled.mirror !== 'LIN' || settled.order !== 'last')
    throw new Error('Generated set/copy cascade or declaration-order last-write-wins behavior is incorrect.')
  if (initial.name !== 'Ada' || candidate.summaryValue !== 'initial summary')
    throw new Error('Generated settlement mutated its published or candidate input.')

  const disabled = generated.settleHomeDemoValues(settled, { ...settled, enabled: false }, ['enabled'], {})
  const disabledProjection = generated.projectHomeDemoState(disabled, {})
  if (disabledProjection.states.name?.required !== false || disabledProjection.states.status?.visible !== false
    || disabledProjection.props.status?.placeholder !== 'Unavailable') {
    throw new Error('Generated state/property projection did not react to changed values.')
  }
  const skipped = generated.settleHomeDemoValues(disabled, { ...disabled, name: 'Ignored' }, ['name'], {})
  if (skipped.summaryValue !== 'LIN' || skipped.mirror !== 'LIN' || skipped.order !== 'last')
    throw new Error('Generated value condition did not skip its guarded action while preserving ordered peers.')

  const cleared = generated.settleHomeDemoValues(settled, { ...settled, status: 'done' }, ['status'], {})
  if (Object.hasOwn(cleared, 'clearable'))
    throw new Error('Generated clear action did not remove the target field.')

  const beforeFailure = structuredClone(settled)
  const failingCandidate = { ...settled, guard: 0 }
  let failed = false
  try {
    generated.settleHomeDemoValues(settled, failingCandidate, ['guard'], {})
  }
  catch {
    failed = true
  }
  if (!failed || JSON.stringify(settled) !== JSON.stringify(beforeFailure)
    || (failingCandidate as Record<string, unknown>).order !== 'last') {
    throw new Error('Generated expression failure published a staged value write.')
  }

  if (fileSet.kind !== 'config-bindings')
    return
  const configUrl = pathToFileURL(join(root, 'src/surfaces/home/config.ts')).href
  const config = await import(`${configUrl}?generated-config=${Date.now()}`) as {
    initialModel: Record<string, unknown>
    createFields: (context: {
      actions: GeneratedBindingActions
      validation: { validate: (request: GeneratedBindingValidationRequest) => Promise<boolean> }
      values: { value: Record<string, unknown> }
      parameters: { readonly value: Readonly<Record<string, unknown>> }
    }) => unknown[]
  }
  const values = { value: structuredClone(config.initialModel) }
  const opened: { surfaceId: string, parameters: Readonly<Record<string, unknown>> }[] = []
  const actions: GeneratedBindingActions = {
    async navigate() {},
    back() {},
    open(surfaceId, parameters) {
      opened.push({ surfaceId, parameters: structuredClone(parameters) })
    },
    closeCurrent() {},
    closeAll() {},
  }
  const findNode = (items: unknown[], nodeId: string): Record<string, unknown> | undefined => {
    for (const item of items) {
      if (!item || typeof item !== 'object')
        continue
      const record = item as Record<string, unknown>
      if (record.id === nodeId)
        return record
      const slots = record.slots
      if (slots && typeof slots === 'object') {
        for (const children of Object.values(slots as Record<string, unknown>)) {
          if (Array.isArray(children)) {
            const found = findNode(children, nodeId)
            if (found)
              return found
          }
        }
      }
    }
    return undefined
  }
  const validationRequests: GeneratedBindingValidationRequest[] = []
  let fields: unknown[] = []
  const validation = {
    async validate(request: GeneratedBindingValidationRequest): Promise<boolean> {
      validationRequests.push(structuredClone(request))
      for (const nodeId of request.fieldIds) {
        const field = findNode(fields, nodeId)
        const fieldName = field?.field
        const schema = field?.schema as { safeParse?: (value: unknown) => { success: boolean } } | undefined
        if (typeof fieldName !== 'string' || typeof schema?.safeParse !== 'function')
          return false
        if (!schema.safeParse(values.value[fieldName]).success)
          return false
      }
      return true
    },
  }
  fields = config.createFields({ actions, validation, values, parameters: { value: {} } })
  const listenerFor = (nodeId: string, listenerProp = 'onUpdate:modelValue'): (() => void | Promise<void>) => {
    const props = findNode(fields, nodeId)?.props as Record<string, unknown> | undefined
    const listener = props?.[listenerProp]
    if (typeof listener !== 'function')
      throw new Error(`Generated ConfigForm binding omitted the ${nodeId}/${listenerProp} host listener.`)
    return listener as () => void | Promise<void>
  }
  if (values.value.summaryValue !== 'initial summary')
    throw new Error('Generated ConfigForm binding ran value actions during initialization.')
  const profile = values.value.profile as { orders?: { details?: { name?: unknown } }[] } | undefined
  const orders = profile?.orders
  if (orders?.length !== 2 || orders.some(order => order.details?.name !== 'Nested default'))
    throw new Error('Generated ConfigForm binding did not preserve nested object/array defaults.')
  orders[0]!.details!.name = 'First row only'
  if (orders[1]!.details?.name !== 'Nested default')
    throw new Error('Generated ConfigForm binding shared nested values across array rows.')
  values.value = { ...values.value, name: 'a1' }
  await listenerFor('open', 'onClick')()
  if (opened.length !== 0)
    throw new Error('Generated minLength/regex validation did not block the host action.')
  values.value = { ...values.value, name: 'Ada' }
  await listenerFor('open', 'onClick')()
  const validationRequest = validationRequests.at(-1)
  if (validationRequests.length !== 2 || validationRequest?.surfaceId !== 'home'
    || validationRequest.scope !== 'fields' || validationRequest.fieldIds.join(',') !== 'name') {
    throw new Error('Generated ConfigForm binding did not invoke the host validation gate.')
  }
  if (Number(opened.length) !== 1 || opened[0]?.surfaceId !== 'details' || opened[0]?.parameters.name !== 'Ada')
    throw new Error('Generated ConfigForm binding did not invoke the named host open action.')
  values.value = { ...values.value, name: 'Host write' }
  listenerFor('name')()
  if (values.value.summaryValue !== 'HOST WRITE' || values.value.mirror !== 'HOST WRITE' || values.value.order !== 'last')
    throw new Error('Generated ConfigForm host listener did not settle after the internal model write.')
  const committed = structuredClone(values.value)
  values.value = { ...values.value, guard: 0 }
  try {
    listenerFor('guard')()
  }
  catch {
    // The configured listener rethrows after restoring the last committed snapshot.
  }
  if (JSON.stringify(values.value) !== JSON.stringify(committed))
    throw new Error('Generated ConfigForm host listener did not roll back a failed settlement.')
}

async function verifyGeneratedNavigation(root: string): Promise<void> {
  const moduleUrl = pathToFileURL(join(root, 'src/demo-navigation.ts')).href
  const valuesModuleUrl = pathToFileURL(join(root, 'src/demo-values.ts')).href
  const generated = await import(`${moduleUrl}?generated-consumer=${Date.now()}`) as {
    createDemoNavigation: (router: {
      push: (location: {
        path?: unknown
        force?: unknown
        state?: { demoPage?: { instanceId?: unknown } }
      }) => Promise<void>
      back: () => void
      afterEach: (callback: (to: { name?: unknown }) => void) => () => void
    }) => GeneratedDemoNavigation
  }
  const demoValues = await import(`${valuesModuleUrl}?generated-consumer=${Date.now()}`) as {
    calculateDemoNumber: (left: unknown, right: unknown, operator: '+' | '-' | '*' | '/' | '%') => number
    compareDemoValues: (left: unknown, right: unknown, operator: '>' | '>=' | '<' | '<=') => boolean
    demoValuesEqual: (left: unknown, right: unknown) => boolean
  }
  if (!demoValues.demoValuesEqual({ first: 1, second: [2] }, { second: [2], first: 1 }))
    throw new Error('Generated expression equality depends on object key order.')
  try {
    demoValues.compareDemoValues(1, '1', '>')
    throw new Error('Generated expression comparison accepted mixed operand types.')
  }
  catch (error) {
    if (error instanceof Error && error.message === 'Generated expression comparison accepted mixed operand types.')
      throw error
  }
  try {
    demoValues.calculateDemoNumber(1, 0, '/')
    throw new Error('Generated expression arithmetic accepted division by zero.')
  }
  catch (error) {
    if (error instanceof Error && error.message === 'Generated expression arithmetic accepted division by zero.')
      throw error
  }
  const pushed: {
    path?: unknown
    force?: unknown
    state?: { demoPage?: { instanceId?: unknown } }
  }[] = []
  let backCount = 0
  const navigation = generated.createDemoNavigation({
    async push(location) {
      pushed.push(structuredClone(location))
    },
    back() {
      backCount += 1
    },
    afterEach() {
      return () => {}
    },
  })
  const snapshotPage = () => structuredClone(navigation.currentPage.value)
  if (navigation.pageHistory.length !== 1 || navigation.currentPage.value.surfaceId !== 'home'
    || navigation.currentPage.value.route !== '/home') {
    throw new Error('Generated navigation did not initialize a page instance for the home route.')
  }
  const completed: { name: string, value: unknown }[] = []
  const firstParameters = { depth: 1 }

  navigation.open('details', firstParameters, result => completed.push(result))
  firstParameters.depth = 99
  navigation.open('drawer', { depth: 2 })
  navigation.open('details', { depth: 3 }, result => completed.push(result))
  if (navigation.overlays.some(item => Object.hasOwn(item, 'complete') || Object.hasOwn(item, 'opener')))
    throw new Error('Generated navigation leaked functions or DOM nodes into overlay state.')
  if (navigation.overlays.map(item => item.surfaceId).join(',') !== 'details,drawer,details')
    throw new Error('Generated navigation did not preserve the nested Dialog/Drawer/Dialog stack.')
  if (navigation.overlays[0]?.parameters.depth !== 1)
    throw new Error('Generated navigation did not detach overlay parameters.')

  navigation.closeCurrent({ name: 'saved', value: { name: 'Grace' } })
  if (completed.length !== 1 || completed[0]?.name !== 'saved')
    throw new Error('Generated navigation did not publish the top overlay result.')
  navigation.back()
  if (navigation.overlays.map(item => item.surfaceId).join(',') !== 'details')
    throw new Error('Generated navigation back did not close only the top overlay.')
  navigation.closeAll()
  if (navigation.overlays.length !== 0)
    throw new Error('Generated navigation did not close all overlays.')
  navigation.back()
  if (Number(backCount) !== 0)
    throw new Error('Generated navigation left the session when no previous page instance existed.')

  navigation.open('drawer')
  const firstPageParameters = { from: 'page-a' }
  await navigation.navigate('summary', firstPageParameters)
  const firstPage = snapshotPage()
  firstPageParameters.from = 'changed'
  await navigation.navigate('home', { from: 'page-b' })
  if (navigation.overlays.length !== 0 || pushed.at(-1)?.path !== '/home')
    throw new Error('Generated navigation did not clear overlays before page navigation.')
  navigation.back()
  const restoredFirstPage = snapshotPage()
  if (restoredFirstPage.instanceId !== firstPage.instanceId
    || restoredFirstPage.route !== '/summary'
    || restoredFirstPage.parameters.from !== 'page-a'
    || Number(backCount) !== 1) {
    throw new Error('Generated navigation did not restore the prior page instance and parameters on back.')
  }

  await navigation.navigate('summary', { from: 'same-route-a' })
  const firstSameRoutePage = snapshotPage()
  await navigation.navigate('summary', { from: 'same-route-b' })
  const secondSameRoutePage = snapshotPage()
  const sameRoutePushes = pushed.slice(-2)
  if (firstSameRoutePage.instanceId === secondSameRoutePage.instanceId
    || sameRoutePushes.some(item => item.path !== '/summary' || item.force !== true)
    || sameRoutePushes[0]?.state?.demoPage?.instanceId === sameRoutePushes[1]?.state?.demoPage?.instanceId) {
    throw new Error('Generated navigation did not create a forced history entry and key for same-route navigation.')
  }
  navigation.back()
  const restoredSameRoutePage = snapshotPage()
  if (restoredSameRoutePage.instanceId !== firstSameRoutePage.instanceId
    || restoredSameRoutePage.parameters.from !== 'same-route-a'
    || Number(backCount) !== 2) {
    throw new Error('Generated navigation did not restore same-route page parameters on back.')
  }

  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const elementDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement')
  class FocusTarget {
    isConnected = true
    focusCount = 0

    focus(): void {
      this.focusCount += 1
    }
  }
  const focusDocument: { activeElement: FocusTarget } = { activeElement: new FocusTarget() }
  try {
    Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: FocusTarget })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: focusDocument })
    const focusNavigation = generated.createDemoNavigation({
      async push() {},
      back() {},
      afterEach() {
        return () => {}
      },
    })
    const firstOpener = focusDocument.activeElement
    focusNavigation.open('details')
    focusDocument.activeElement = new FocusTarget()
    const nestedOpener = focusDocument.activeElement
    focusNavigation.open('drawer')
    focusDocument.activeElement = new FocusTarget()
    const repeatedOpener = focusDocument.activeElement
    focusNavigation.open('details')
    focusNavigation.closeCurrent()
    await Promise.resolve()
    if (repeatedOpener.focusCount !== 1)
      throw new Error('Generated navigation did not restore the repeated Dialog opener.')
    focusNavigation.closeCurrent()
    await Promise.resolve()
    if (nestedOpener.focusCount !== 1)
      throw new Error('Generated navigation did not restore the nested overlay opener.')
    focusNavigation.closeAll()
    await Promise.resolve()
    if (firstOpener.focusCount !== 1)
      throw new Error('Generated navigation did not restore the root overlay opener after closeAll.')
  }
  finally {
    if (documentDescriptor)
      Object.defineProperty(globalThis, 'document', documentDescriptor)
    else
      Reflect.deleteProperty(globalThis, 'document')
    if (elementDescriptor)
      Object.defineProperty(globalThis, 'HTMLElement', elementDescriptor)
    else
      Reflect.deleteProperty(globalThis, 'HTMLElement')
  }
}

export async function verifyGeneratedConsumer(fileSet: SourceFileSetV1): Promise<void> {
  const consumerRoot = await mkdtemp(join(tmpdir(), 'config-form-source-consumer-'))
  try {
    await writeGeneratedFiles(consumerRoot, fileSet)
    await linkConsumerDependencies(consumerRoot, fileSet)
    await verifyGeneratedInteractions(consumerRoot, fileSet)
    if (fileSet.kind === 'raw-source')
      await verifyGeneratedNavigation(consumerRoot)
    try {
      await execFileAsync(process.execPath, [vueTscBin, '-p', 'tsconfig.json', '--noEmit'], {
        cwd: consumerRoot,
        windowsHide: true,
      })
    }
    catch (error) {
      const failure = error as { stdout?: string, stderr?: string }
      throw new Error([
        `${fileSet.kind} generated consumer typecheck failed.`,
        failure.stdout,
        failure.stderr,
        ...textFiles(fileSet)
          .filter(file => file.path.endsWith('.vue'))
          .map(file => `--- ${file.path} ---\n${file.content}`),
      ].filter(Boolean).join('\n'))
    }
    try {
      await execFileAsync(process.execPath, [viteBin, 'build', '--logLevel', 'error'], {
        cwd: consumerRoot,
        windowsHide: true,
      })
    }
    catch (error) {
      const failure = error as { stdout?: string, stderr?: string }
      throw new Error([
        `${fileSet.kind} generated consumer build failed.`,
        failure.stdout,
        failure.stderr,
      ].filter(Boolean).join('\n'))
    }
  }
  finally {
    await rm(consumerRoot, { recursive: true, force: true })
  }
}
