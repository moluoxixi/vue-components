// @vitest-environment happy-dom
import type { ConfigFormPageRuntimePlan, ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { PageCompilation, SemanticCompilerEnvironment } from '@moluoxixi/config-form-compiler'
import type { ConfigFormDataSourceHost, ConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'
import type { ComponentContract, FieldNode, LayoutNode, ProjectDocument } from '@moluoxixi/config-form-model'
import type { VueRuntimeBindingResolver, VueRuntimeDiagnostic, VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { CanonicalConfigExport, CanonicalSourceBindingResolver, ConfigRuntimeBindingRequirement } from '../export'
import { posix, resolve } from 'node:path'
import { runInThisContext } from 'node:vm'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { compileCanonicalPage, compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { createComponentContractRegistry, createProjectDraftSnapshot, createProjectSnapshot, createRegistryContractSnapshot } from '@moluoxixi/config-form-model'
import * as VueBackend from '@moluoxixi/config-form-vue-backend'
import { flushPromises, mount } from '@vue/test-utils'
import ts from 'typescript'
import { transformWithEsbuild } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { createCanonicalProjectConfigExport } from '../export'

interface RuntimeResolver extends VueRuntimeBindingResolver {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
}
interface RuntimeHost {
  flowActions?: ConfigFormFlowActionRegistry
  dataSourceHost?: ConfigFormDataSourceHost
}
interface GeneratedPage {
  pageCompilation: PageCompilation
  plan: ConfigFormPageRuntimePlan
  initialValues: Record<string, unknown>
  requiredBindings: readonly ConfigRuntimeBindingRequirement[]
  createRendererConfig: (resolver: RuntimeResolver, host?: RuntimeHost) => VueRuntimeRendererConfig & RuntimeHost & { defaultValues: Record<string, unknown> }
}

const Control = defineComponent({
  inheritAttrs: false,
  props: ['value'],
  emits: ['commit', 'blur'],
  setup: (props, { attrs, emit }) => () => h('input', {
    ...attrs,
    value: props.value,
    onInput: (event: Event) => emit('commit', (event.target as HTMLInputElement).value),
    onBlur: () => emit('blur', 'blurred'),
  }),
})
const Layout = defineComponent({ setup: (_, { slots }) => () => h('section', slots.default?.()) })
const dangerousText = `</script><script>globalThis.__configExecuted = true</script> \${globalThis.__configExecuted = true} " \\ \u2028\u2029`
const wrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

function field(id: string, name: string, options: Partial<FieldNode> = {}): FieldNode {
  return { id, kind: 'field', component: 'test.input', field: name, props: { 'data-key': id }, events: {}, bindings: {}, ...options }
}
function layout(id: string, scope: LayoutNode['valueScope'], children: string[]): LayoutNode {
  return {
    id,
    kind: 'layout',
    component: 'test.layout',
    valueScope: scope,
    props: {},
    events: {},
    bindings: {},
    slots: { default: children.map(nodeId => ({ nodeId, placement: { span: 6 } })) },
  }
}
function fixture(update?: (document: ProjectDocument) => void, draft = false) {
  const contracts: ComponentContract[] = [
    {
      key: 'test.input',
      version: '1',
      kind: 'field',
      props: [{ key: 'data-key', path: ['props', 'data-key'] }, { key: 'placeholder', path: ['props', 'placeholder'] }],
      events: [{ name: 'commit' }, { name: 'blur' }],
      bindings: [{ name: 'model', valueProp: 'value', trigger: 'commit' }],
      slots: [],
      allowedParents: [],
      defaults: { placeholder: 'Registry default' },
    },
    { key: 'test.layout', version: '1', kind: 'layout', props: [], events: [], bindings: [], slots: [{ name: 'default' }], allowedParents: [], defaults: {} },
  ]
  const registry = createComponentContractRegistry(contracts, { adapter: 'test', version: '1' })
  const document: ProjectDocument = {
    version: 4,
    id: 'config-parity',
    name: dangerousText,
    homePageId: 'home',
    pageOrder: ['home'],
    registryLock: registry.lock,
    settings: { locale: 'en' },
    resources: {},
    pagesById: { home: {
      id: 'home',
      name: 'Home',
      route: '/',
      runtime: {
        variables: [{ id: 'locale', name: 'Locale', initialValue: 'en-US' }],
        dataSources: [{
          id: 'choices',
          name: 'Choices',
          auto: true,
          timeoutMs: 1200,
          cacheTtlMs: 600,
          request: { url: '/api/choices', method: 'POST', headers: { 'x-locale': { $ref: { kind: 'variable', variableId: 'locale' } } }, query: { q: 'fixed' }, body: { $ref: { kind: 'field', nodeId: 'mode', scope: 'root' } }, responseType: 'json' },
          mapping: { $ref: { kind: 'event', path: ['data'] } },
          dependencies: [{ kind: 'variable', variableId: 'locale' }],
        }],
      },
      flows: [{
        version: 1,
        id: 'line-event',
        name: 'Line event',
        trigger: { kind: 'component.event', nodeId: 'line-total', event: 'blur' },
        concurrency: 'queue',
        errorPolicy: { onError: 'failure', timeoutMs: 800 },
        nodes: [
          { id: 'start', type: 'trigger', position: { x: 20, y: 30 } },
          { id: 'capture', type: 'action', ref: 'host.capture', config: { input: {
            current: { $ref: { kind: 'field', nodeId: 'line-total' } },
            parent: { $ref: { kind: 'field', nodeId: 'order-title', scope: 'parent' } },
            root: { $ref: { kind: 'field', nodeId: 'mode', scope: 'root' } },
            locale: { $ref: { kind: 'variable', variableId: 'locale' } },
            event: { $ref: { kind: 'event', path: ['args', '0'] } },
          } } },
          { id: 'finish', type: 'action', ref: 'host.finish', config: { input: { $ref: { kind: 'output', stepId: 'capture' } } } },
          { id: 'end', type: 'success' },
        ],
        edges: [
          { id: 'start-capture', source: 'start', target: 'capture' },
          { id: 'capture-finish', source: 'capture', target: 'finish' },
          { id: 'finish-end', source: 'finish', target: 'end' },
        ],
      }],
      graph: {
        version: 2,
        props: { surface: 'canonical' },
        form: { columns: 12, fieldSpan: 6, gap: '18px', labelPosition: 'left', labelWidth: 130, inline: false, responsive: { tablet: { columns: 6 }, mobile: { columns: 1, labelWidth: 75 } } },
        root: ['mode', 'literal', 'missing', 'billing', 'shipping', 'orders'].map(nodeId => ({ nodeId, placement: { span: 12 } })),
        nodesById: {
          'mode': field('mode', 'mode', { defaultValue: 'edit' }),
          'literal': field('literal', 'literal.key', { defaultValue: dangerousText }),
          'missing': field('missing', 'missing'),
          'billing': layout('billing', { kind: 'object', field: 'billing' }, ['billing-name']),
          'billing-name': field('billing-name', 'name', {
            defaultValue: 'Ada',
            label: 'Billing name',
            validateOn: ['blur', 'blur'],
            validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Name required' }] },
            conditions: {
              visible: { kind: 'literal', value: true },
              required: { kind: 'literal', value: true },
              ...Object.fromEntries(['hidden', 'disabled', 'readonly'].map(key => [key, { kind: 'compare', operator: 'eq', left: { kind: 'field', field: 'mode' }, right: { kind: 'literal', value: key } }])),
            },
            events: { blur: [{ action: 'host.record', input: { $ref: { kind: 'field', nodeId: 'billing-name' } } }] },
            bindings: { model: { source: 'name' } },
            extensions: { audit: { label: dangerousText } },
          }),
          'shipping': layout('shipping', { kind: 'object', field: 'shipping' }, ['shipping-name']),
          'shipping-name': field('shipping-name', 'name', { defaultValue: 'Grace' }),
          'orders': layout('orders', { kind: 'array', field: 'orders', minItems: 2, maxItems: 4, itemKey: 'id' }, ['order-title', 'details']),
          'order-title': field('order-title', 'title', { defaultValue: 'Order' }),
          'details': layout('details', { kind: 'array', field: 'details', minItems: 1, maxItems: 3 }, ['line-total', 'line-missing']),
          'line-total': field('line-total', 'line.total', { defaultValue: 4, optionSource: { kind: 'dataSource', dataSourceId: 'choices', params: { locale: { $ref: { kind: 'variable', variableId: 'locale' } } } } }),
          'line-missing': field('line-missing', 'missing'),
        },
      },
    } },
  }
  update?.(document)
  const base = createProjectSnapshot(document, 9)
  const snapshot = draft ? createProjectDraftSnapshot(base, document, 'config-draft') : base
  const registrySnapshot = createRegistryContractSnapshot(registry)
  const result = compileCanonicalProject({ snapshot, registry: registrySnapshot, environment: { version: 'parity', features: { test: true } } })
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  const identity = { adapter: registrySnapshot.adapter, adapterVersion: registrySnapshot.adapterVersion, registryFingerprint: registrySnapshot.fingerprint }
  const runtimeResolver: RuntimeResolver = {
    ...identity,
    resolveBinding: (key) => {
      const contract = registry.get(key)
      const lock = registry.lock.components[key]
      return contract && lock ? { component: contract.kind === 'field' ? Control : Layout, kind: contract.kind, contractVersion: lock.contractVersion, contractFingerprint: lock.fingerprint, valueProp: 'value', trigger: 'commit', blurTrigger: 'blur' } : undefined
    },
  }
  const sourceResolver: CanonicalSourceBindingResolver = {
    ...identity,
    resolveBinding: (key) => {
      const lock = registry.lock.components[key]
      return lock ? { component: key, contractVersion: lock.contractVersion, contractFingerprint: lock.fingerprint, configComponent: 'boolean', defaultValue: 'must-not-be-used', tag: 'Control', render: 'component' } : undefined
    },
  }
  return { compilation: result.compilation, runtimeResolver, sourceResolver }
}

async function loadExport(exported: CanonicalConfigExport) {
  const modules = new Map(await Promise.all(Object.entries(exported.files).map(async ([path, file]) => {
    if (file.kind !== 'text')
      throw new Error('Config must contain text modules only.')
    const result = await transformWithEsbuild(file.content, path, { loader: 'ts', format: 'cjs', target: 'es2022' })
    return [path, result.code] as const
  })))
  const imported: string[] = []
  const cache = new Map<string, Record<string, unknown>>()
  function load(path: string): Record<string, unknown> {
    const cached = cache.get(path)
    if (cached)
      return cached
    const code = modules.get(path)
    if (!code)
      throw new Error(`Unexpected Config module: ${path}`)
    const module = { exports: {} }
    cache.set(path, module.exports)
    const require = (specifier: string) => {
      imported.push(specifier)
      if (specifier === '@moluoxixi/config-form-vue-backend')
        return VueBackend
      if (!specifier.startsWith('.'))
        throw new Error(`Config imported an unexpected dependency: ${specifier}`)
      return load(`${posix.normalize(posix.join(posix.dirname(path), specifier))}.ts`)
    }
    runInThisContext(`(function(require, module, exports) {\n${code}\n})`, { filename: path })(require, module, module.exports)
    cache.set(path, module.exports)
    return module.exports
  }
  const entry = load(exported.entry)
  return { entry, imported, page: (entry.pageConfigs as Record<string, GeneratedPage>).home! }
}

function hostActions() {
  const calls: Array<{ ref: string, input: unknown }> = []
  const actions: ConfigFormFlowActionRegistry = { get: ref => ['host.capture', 'host.finish', 'host.record'].includes(ref)
    ? {
        descriptor: { ref, title: ref, category: 'test', parameters: [], outputs: [], capabilities: [] },
        execute: (input) => {
          calls.push({ ref, input })
          return input
        },
      }
    : undefined }
  const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(async () => ({ status: 200, ok: true, data: [{ label: 'Four', value: 4 }] }))
  return { flowActions: actions, dataSourceHost: { request }, calls }
}
async function surfaces(input: ReturnType<typeof fixture>, validator?: RuleCustomValidator, design = false) {
  const { page } = await loadExport(createCanonicalProjectConfigExport(input.compilation, input.sourceResolver))
  const resolver = { ...input.runtimeResolver, resolveValidator: () => validator }
  const direct = VueBackend.compileCanonicalPageRuntime({ compilation: input.compilation, pageId: 'home' }, resolver)
  if (!direct.success)
    throw new Error(JSON.stringify(direct.diagnostics))
  const hosts = [hostActions(), hostActions()]
  const configs = [
    { ...direct.artifact.renderer, flowActions: hosts[0]!.flowActions, dataSourceHost: hosts[0]!.dataSourceHost },
    page.createRendererConfig(resolver, hosts[1]),
  ]
  const mounted = configs.map((config, index) => {
    const values = shallowRef<Record<string, unknown>>({})
    const wrapper = mount(ConfigFormRenderer, { props: { ...config, model: createConfigFormModel(values), mode: design ? 'design' : 'preview' } })
    wrappers.push(wrapper)
    return { wrapper, api: wrapper.vm as unknown as ConfigFormRendererExpose, host: hosts[index]! }
  })
  await flushPromises()
  return { mounted, page, direct: direct.artifact.renderer }
}

const expectedValues = {
  'mode': 'edit',
  'literal.key': dangerousText,
  'billing': { name: 'Ada' },
  'shipping': { name: 'Grace' },
  'orders': [
    { title: 'Order', details: [{ 'line.total': 4 }] },
    { title: 'Order', details: [{ 'line.total': 4 }] },
  ],
}
function diagnostics(run: () => unknown) {
  try {
    run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).name).toBe('ConfigRuntimeBindingError')
    return (error as Error & { diagnostics: VueRuntimeDiagnostic[] }).diagnostics
  }
  throw new Error('Expected ConfigRuntimeBindingError.')
}

describe('executed Config modules and direct Vue backend parity', () => {
  it.each([false, true])('retains exact page/project identities and all canonical execution data (draft=%s)', async (draft) => {
    const input = fixture(undefined, draft)
    const exported = createCanonicalProjectConfigExport(input.compilation, input.sourceResolver)
    const { page, entry, imported } = await loadExport(exported)
    const directPage = compileCanonicalPage({ snapshot: input.compilation.snapshot, registry: input.compilation.registry, environment: structuredClone(input.compilation.ir.environment) as SemanticCompilerEnvironment, pageId: 'home' })
    expect(directPage.success).toBe(true)
    if (!directPage.success)
      throw new Error(JSON.stringify(directPage.diagnostics))
    expect(page.pageCompilation).toEqual(directPage.compilation)
    expect(page.pageCompilation.page).toEqual(input.compilation.ir.pagesById.home)
    expect(entry.project).toMatchObject({ identity: input.compilation.key, origin: input.compilation.origin, pageOrder: ['home'], environment: input.compilation.ir.environment, registry: input.compilation.registry, registryLock: input.compilation.snapshot.document.registryLock })
    expect(imported.filter(path => !path.startsWith('.'))).toEqual(['@moluoxixi/config-form-vue-backend'])
    expect(page.initialValues).toEqual(expectedValues)
    expect(page.initialValues).toEqual(createConfigFormValueScopeStore({ scopes: page.plan.valueSchema.valueScopes, fields: page.plan.valueSchema.scopedFields }).getValues())
    expect(JSON.parse(JSON.stringify(page.plan))).toEqual(page.plan)
    expect(page.plan.flows).toEqual(input.compilation.ir.pagesById.home!.flows.map(flow => flow.plan))
    expect(page.plan.runtime).toEqual(input.compilation.ir.pagesById.home!.runtime)
    expect(page.plan.optionBindings).toHaveLength(1)
    expect(page.plan.optionBindings[0]).toEqual({ nodeId: 'line-total', source: input.compilation.ir.pagesById.home!.nodesById['line-total']!.kind === 'field' ? input.compilation.ir.pagesById.home!.nodesById['line-total']!.optionSource : undefined })
    const config = page.createRendererConfig(input.runtimeResolver, hostActions())
    expect(config.plan).toEqual(page.plan)
    expect(config).toMatchObject(input.compilation.ir.pagesById.home!.form)
    expect(JSON.stringify({ page: page.pageCompilation, plan: page.plan, values: page.initialValues })).not.toContain('rowId')
    expect(Object.hasOwn(page, 'fields')).toBe(false)
    expect(Object.hasOwn(page, 'flows')).toBe(false)
    expect(createCanonicalProjectConfigExport(input.compilation, input.sourceResolver)).toEqual(exported)
  })

  it('mounts natural nested defaults, literal field keys, instance identities and independent resets', async () => {
    const { mounted, page } = await surfaces(fixture())
    for (const { wrapper, api } of mounted) {
      expect(api.getValues()).toEqual(expectedValues)
      expect(wrapper.get('input[data-key="billing-name"]').attributes('placeholder')).toBe('Registry default')
      expect(wrapper.findAll('input[data-key="line-total"]')).toHaveLength(2)
      expect(api.listFieldInstances().filter(item => item.address.nodeId === 'line-total').map(item => item.valuePath)).toEqual([
        ['orders', 0, 'details', 0, 'line.total'],
        ['orders', 1, 'details', 0, 'line.total'],
      ])
      expect(Object.hasOwn(api.getValues(), 'missing')).toBe(false)
      expect(Object.hasOwn(api.getValues(), 'literal')).toBe(false)
      const rows = api.listRows('orders')
      const nested = api.listRows('details', rows[0]!.scope)[0]!
      api.setInstanceValue({ nodeId: 'line-total', scope: nested.scope }, 99)
      expect(api.getValues().orders).toEqual([{ title: 'Order', details: [{ 'line.total': 99 }] }, expectedValues.orders[1]])
      api.moveRow('orders', rows[0]!.rowId, 1)
      expect(api.listRows('orders')[1]!.rowId).toBe(rows[0]!.rowId)
      expect(api.getInstanceValue({ nodeId: 'line-total', scope: nested.scope })).toBe(99)
      expect(await api.resetFields()).toBe(true)
      expect(api.getValues()).toEqual(expectedValues)
      expect(api.getErrors()).toEqual({})
      expect(JSON.stringify(api.getValues())).not.toContain('rowId')
    }
    expect(page.initialValues).toEqual(expectedValues)
    const first = page.createRendererConfig(fixture().runtimeResolver, hostActions())
    ;(first.defaultValues.billing as Record<string, unknown>).name = 'Changed outside renderer'
    expect(page.initialValues).toEqual(expectedValues)
  })

  it('executes blur validation, full conditions, readonly layout and reset identically', async () => {
    const { mounted, page } = await surfaces(fixture())
    const node = page.pageCompilation.page.nodesById['billing-name']!
    expect(node.kind === 'field' && node.validateOn).toEqual(['blur', 'submit'])
    for (const { wrapper, api } of mounted) {
      await wrapper.get('input[data-key="billing-name"]').setValue('')
      expect(api.getErrors()).toEqual({})
      await wrapper.get('input[data-key="billing-name"]').trigger('blur')
      await flushPromises()
      expect(api.getInstanceErrors({ nodeId: 'billing-name', scope: [] })).toEqual(['Name required'])
      expect(await api.submit()).toBe(false)
      await wrapper.get('input[data-key="mode"]').setValue('disabled')
      await flushPromises()
      expect(wrapper.get('input[data-key="billing-name"]').attributes('disabled')).toBeDefined()
      await wrapper.get('input[data-key="mode"]').setValue('readonly')
      await flushPromises()
      expect(wrapper.find('input[data-key="billing-name"]').exists()).toBe(false)
      expect(await api.submit()).toBe(true)
      await wrapper.get('input[data-key="mode"]').setValue('hidden')
      await flushPromises()
      expect(wrapper.find('input[data-key="billing-name"]').exists()).toBe(false)
      await api.resetFields()
      await flushPromises()
      expect(api.getValues()).toEqual(expectedValues)
      expect(api.getErrors()).toEqual({})
      expect(wrapper.find('input[data-key="billing-name"]').exists()).toBe(true)
    }
    const readonly = await surfaces(fixture((document) => {
      document.pagesById.home!.graph.form.readonly = true
    }))
    for (const { wrapper, api } of readonly.mounted) {
      expect(wrapper.find('input').exists()).toBe(false)
      expect(api.getValues()).toEqual(expectedValues)
      expect(await api.submit()).toBe(true)
    }
  })

  it('executes compiled flows with current/parent/root, variable, event and upstream output references', async () => {
    const { mounted } = await surfaces(fixture())
    for (const { wrapper, api, host } of mounted) {
      await wrapper.findAll('input[data-key="line-total"]')[1]!.trigger('blur')
      await flushPromises()
      const input = { current: 4, parent: 'Order', root: 'edit', locale: 'en-US', event: 'blurred' }
      expect(host.calls).toEqual([{ ref: 'host.capture', input }, { ref: 'host.finish', input }])
      expect(wrapper.emitted('flowError')).toBeUndefined()
      await wrapper.get('input[data-key="billing-name"]').trigger('blur')
      await flushPromises()
      expect(host.calls.at(-1)).toEqual({ ref: 'host.record', input: 'Ada' })
      expect(api.getValues()).toEqual(expectedValues)
    }
  })

  it('keeps all registry and component identity checks and precisely locates missing bindings', async () => {
    const input = fixture()
    const { page } = await loadExport(createCanonicalProjectConfigExport(input.compilation, input.sourceResolver))
    for (const key of ['adapter', 'adapterVersion', 'registryFingerprint'] as const) {
      expect(() => createCanonicalProjectConfigExport(input.compilation, { ...input.sourceResolver, [key]: 'stale' })).toThrow('Registry identity')
      expect(diagnostics(() => page.createRendererConfig({ ...input.runtimeResolver, [key]: 'stale' }, hostActions()))).toEqual([expect.objectContaining({ code: 'CONFIG_RUNTIME_REGISTRY_IDENTITY_MISMATCH', pageId: 'home', path: ['registryIdentity'] })])
    }
    expect(() => createCanonicalProjectConfigExport(input.compilation, { ...input.sourceResolver, resolveBinding: () => undefined })).toThrow('page "home" at ["nodesById","mode","component"]')
    expect(diagnostics(() => page.createRendererConfig({ ...input.runtimeResolver, resolveBinding: component => component === 'test.layout' ? input.runtimeResolver.resolveBinding(component) : undefined }, hostActions()))).toContainEqual(expect.objectContaining({ code: 'VUE_RUNTIME_BINDING_UNAVAILABLE', nodeId: 'line-total', pageId: 'home', path: ['nodesById', 'line-total', 'component'] }))
    for (const key of ['contractVersion', 'contractFingerprint'] as const) {
      expect(() => createCanonicalProjectConfigExport(input.compilation, { ...input.sourceResolver, resolveBinding: component => ({ ...input.sourceResolver.resolveBinding(component)!, [key]: 'stale' }) })).toThrow('compilation Registry snapshot')
      expect(diagnostics(() => page.createRendererConfig({ ...input.runtimeResolver, resolveBinding: component => ({ ...input.runtimeResolver.resolveBinding(component)!, [key]: 'stale' }) }, hostActions()))).toContainEqual(expect.objectContaining({ code: 'VUE_RUNTIME_BINDING_IDENTITY_MISMATCH', pageId: 'home', nodeId: 'mode' }))
    }
    const missingActions = diagnostics(() => page.createRendererConfig(input.runtimeResolver, { dataSourceHost: hostActions().dataSourceHost }))
    expect(missingActions).toHaveLength(3)
    for (const required of page.requiredBindings.filter(binding => binding.kind === 'action')) {
      expect(missingActions).toContainEqual(expect.objectContaining({ code: 'CONFIG_RUNTIME_ACTION_BINDING_UNAVAILABLE', pageId: required.pageId, nodeId: required.nodeId, flowId: required.flowId, path: required.path }))
    }
  })

  it('requires custom validators and runs the trusted host implementation in the mounted renderer', async () => {
    const input = fixture((document) => {
      const node = document.pagesById.home!.graph.nodesById['billing-name'] as FieldNode
      node.validation!.rules.push({ kind: 'custom', key: 'unique' })
    })
    const { page } = await loadExport(createCanonicalProjectConfigExport(input.compilation, input.sourceResolver))
    expect(page.requiredBindings).toContainEqual({ kind: 'validator', ref: 'unique', pageId: 'home', nodeId: 'billing-name', path: ['nodesById', 'billing-name', 'validation', 'rules', 1, 'key'] })
    const errors = diagnostics(() => page.createRendererConfig(input.runtimeResolver, hostActions()))
    expect(errors).toContainEqual(expect.objectContaining({ code: 'RULE_CUSTOM_VALIDATOR_MISSING', nodeId: 'billing-name', pageId: 'home', path: ['nodesById', 'billing-name', 'validation', 'rules', 1] }))
    const validate = vi.fn<RuleCustomValidator>(async value => value === 'Taken' ? 'Already used' : undefined)
    const { mounted } = await surfaces(input, validate)
    for (const { wrapper, api } of mounted) {
      await wrapper.get('input[data-key="billing-name"]').setValue('Taken')
      await wrapper.get('input[data-key="billing-name"]').trigger('blur')
      await flushPromises()
      expect(api.getInstanceErrors({ nodeId: 'billing-name', scope: [] })).toEqual(['Already used'])
      await api.resetFields()
      expect(api.getErrors()).toEqual({})
    }
    expect(validate).toHaveBeenCalled()
  })

  it('does not execute configuration text or make import/design requests', async () => {
    vi.stubGlobal('__configExecuted', false)
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const input = fixture()
    const exported = createCanonicalProjectConfigExport(input.compilation, input.sourceResolver)
    const { page } = await loadExport(exported)
    expect(request).not.toHaveBeenCalled()
    expect(JSON.stringify(exported.files)).not.toContain('</script>')
    expect(page.initialValues['literal.key']).toBe(dangerousText)
    const host = hostActions()
    page.createRendererConfig(input.runtimeResolver, host)
    expect(host.dataSourceHost.request).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
    const { mounted } = await surfaces(input, undefined, true)
    for (const { wrapper, host } of mounted) {
      await wrapper.findAll('input[data-key="line-total"]')[0]!.trigger('blur')
      await flushPromises()
      expect(host.calls).toEqual([])
      expect(host.dataSourceHost.request).not.toHaveBeenCalled()
    }
    expect(request).not.toHaveBeenCalled()
    expect(Reflect.get(globalThis, '__configExecuted')).toBe(false)
  })

  it.each(['__proto__', 'constructor', 'prototype'])('rejects unsafe field keys and metadata keys: %s', async (key) => {
    expect(() => fixture((document) => {
      const node = document.pagesById.home!.graph.nodesById.missing as FieldNode
      node.field = key
    })).toThrow()
    const input = fixture()
    const unsafe = JSON.parse(JSON.stringify(input.compilation))
    unsafe.ir.settings = { nested: JSON.parse(`{"${key}":true}`) }
    expect(() => createCanonicalProjectConfigExport(unsafe, input.sourceResolver)).toThrow(`Unsafe Config object key "${key}"`)
    expect(Reflect.get(Object.prototype, 'polluted')).toBeUndefined()
  })

  it('exports working, ordered page imports with colliding normalized directories', async () => {
    const input = fixture((document) => {
      for (const id of ['same.page', 'same-page']) {
        const page = structuredClone(document.pagesById.home!)
        page.id = id
        page.route = `/${id}`
        document.pagesById[id] = page
        document.pageOrder.push(id)
      }
    })
    const exported = createCanonicalProjectConfigExport(input.compilation, input.sourceResolver)
    const { entry } = await loadExport(exported)
    expect(Object.keys(entry.pageConfigs as object)).toEqual(['home', 'same.page', 'same-page'])
    expect(Object.keys(exported.files)).toHaveLength(4)
    for (const [id, page] of Object.entries(entry.pageConfigs as Record<string, GeneratedPage>)) {
      expect(page.pageCompilation.key.pageId).toBe(id)
      expect(page.createRendererConfig(input.runtimeResolver, hostActions()).plan).toEqual(page.plan)
    }
  })

  it('requires an explicit request host and mounts scoped options and page runtime without losing request values', async () => {
    const input = fixture()
    const { page } = await loadExport(createCanonicalProjectConfigExport(input.compilation, input.sourceResolver))
    expect(page.requiredBindings).toContainEqual({ kind: 'dataSource', ref: 'choices', sourceId: 'choices', pageId: 'home', path: ['runtime', 'dataSources', 0, 'request'] })
    expect(diagnostics(() => page.createRendererConfig(input.runtimeResolver, { flowActions: hostActions().flowActions }))).toEqual([expect.objectContaining({ code: 'CONFIG_RUNTIME_DATA_SOURCE_HOST_MISSING', pageId: 'home', sourceId: 'choices', path: ['runtime', 'dataSources', 0, 'request'] })])
    const { mounted } = await surfaces(input)
    for (const { api, wrapper, host } of mounted) {
      expect(api.getVariables()).toEqual({ locale: 'en-US' })
      expect(host.dataSourceHost.request).toHaveBeenCalledTimes(3)
      for (const [request, signal] of host.dataSourceHost.request.mock.calls) {
        expect(request).toMatchObject({ url: '/api/choices', method: 'POST', headers: { 'x-locale': 'en-US' }, query: { q: 'fixed' }, body: 'edit', responseType: 'json' })
        expect(signal).toBeInstanceOf(AbortSignal)
      }
      const scopedRequests = host.dataSourceHost.request.mock.calls.filter(([request]) => request.query?.locale === 'en-US')
      expect(scopedRequests).toHaveLength(2)
      for (const instance of api.listFieldInstances().filter(item => item.address.nodeId === 'line-total'))
        expect(api.getOptionState(instance.address)).toMatchObject({ status: 'success', options: [{ label: 'Four', value: 4 }] })
      expect(wrapper.emitted('flowError')).toBeUndefined()
    }
  })

  it('leaves renderer-owned builtins in the compiled plan without requiring business implementations', async () => {
    const input = fixture((document) => {
      document.pagesById.home!.flows!.push({
        version: 1,
        id: 'initialize',
        name: 'Initialize',
        trigger: { kind: 'form.initialize' },
        nodes: [{ id: 'start', type: 'trigger' }, { id: 'set', type: 'action', ref: 'builtin.variable.set', config: { input: { variableId: 'locale', value: 'fr-FR' } } }, { id: 'end', type: 'success' }],
        edges: [{ id: 'start-set', source: 'start', target: 'set' }, { id: 'set-end', source: 'set', target: 'end' }],
      })
    })
    const { mounted, page } = await surfaces(input)
    expect(page.requiredBindings.some(binding => binding.ref === 'builtin.variable.set')).toBe(false)
    expect(page.plan.flows.some(flow => flow.nodes.some(node => node.ref === 'builtin.variable.set'))).toBe(true)
    for (const { api, wrapper } of mounted) {
      expect(api.getVariables()).toEqual({ locale: 'fr-FR' })
      expect(wrapper.emitted('flowError')).toBeUndefined()
    }
  })

  it('typechecks generated modules and a real Renderer consumer against public package declarations', () => {
    const input = fixture()
    const exported = createCanonicalProjectConfigExport(input.compilation, input.sourceResolver)
    const normalize = (path: string) => path.replaceAll('\\', '/')
    const root = normalize(resolve(process.cwd(), '__virtual_config_consumer__'))
    const files = new Map(Object.entries(exported.files).map(([path, file]) => {
      if (file.kind !== 'text')
        throw new Error('Config must contain text modules only.')
      return [`${root}/${path}`, file.content]
    }))
    files.set(`${root}/consumer.ts`, `
import type { ConfigFormRendererProps } from '@moluoxixi/config-form'
import type { RuntimeBindingResolver, RuntimeHostBindings } from './pages/home/form.config'
import { pageConfigs } from './project.config'
declare const model: ConfigFormRendererProps['model']
declare const resolver: RuntimeBindingResolver
declare const host: RuntimeHostBindings
export const props: ConfigFormRendererProps = { ...pageConfigs.home.createRendererConfig(resolver, host), model }
`)
    const options: ts.CompilerOptions = { strict: true, noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }
    const host = ts.createCompilerHost(options)
    const original = { readFile: host.readFile, fileExists: host.fileExists, directoryExists: host.directoryExists, getSourceFile: host.getSourceFile }
    host.readFile = path => files.get(normalize(path)) ?? original.readFile(path)
    host.fileExists = path => files.has(normalize(path)) || original.fileExists(path)
    host.directoryExists = path => normalize(path).startsWith(root) || original.directoryExists?.(path) === true
    host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => {
      const text = files.get(normalize(path))
      return text === undefined ? original.getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile) : ts.createSourceFile(path, text, languageVersion)
    }
    const program = ts.createProgram([...files.keys()], options, host)
    expect(ts.getPreEmitDiagnostics(program).map(item => ({ file: item.file?.fileName, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') }))).toEqual([])
  })
})
