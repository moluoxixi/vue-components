import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { CanonicalSourceActionBinding, CanonicalSourceBindingResolver } from '../export'
import { getConfigFormRuntimeSources } from '@moluoxixi/config-form-compiler'
import { analyzeConfigFormFlow, CONFIG_FORM_FLOW_VERSION, getConfigFormFlowSemanticHash } from '@moluoxixi/config-form-core'
import { describe, expect, it, vi } from 'vitest'
import { collectSourceActionBindings, SourceActionBindingError } from '../export/services/source-action-bindings'
import { createStandaloneFlowRuntimeSource } from '../export/services/source-flow'
import { canonicalProjectPackage } from '../export/services/source-project-files'
import { createGeneratedModuleLoader } from './generated-runtime-module'

function page(refs = ['host.save']) {
  const nodes: ConfigFormFlow['nodes'] = [
    { id: 'start', type: 'trigger' },
    ...refs.map((ref, index) => ({ id: `action-${index}`, type: 'action' as const, ref, config: { input: { ms: 0 } } })),
    { id: 'end', type: 'end' },
  ]
  const flow: ConfigFormFlow = {
    version: CONFIG_FORM_FLOW_VERSION,
    id: 'save',
    name: 'Save',
    trigger: { kind: 'form.submit' },
    nodes,
    edges: nodes.slice(1).map((node, index) => ({ id: `edge-${index}`, source: nodes[index]!.id, target: node.id })),
  }
  const analysis = analyzeConfigFormFlow(flow)
  if (!analysis.success)
    throw new Error(JSON.stringify(analysis.diagnostics))
  return { id: 'home', flows: [{ plan: analysis.plan, semanticHash: getConfigFormFlowSemanticHash(flow) }] }
}

function resolver(resolveAction?: CanonicalSourceBindingResolver['resolveAction']): CanonicalSourceBindingResolver {
  return { adapter: 'test', adapterVersion: '1', registryFingerprint: 'test', resolveBinding: () => undefined, resolveAction }
}

function localBinding(path = 'src/actions/save.ts'): CanonicalSourceActionBinding {
  return { exportName: 'save', module: { kind: 'file', path, content: 'export function save(input: unknown) { return input }\n' } }
}

describe('standalone action binding preflight', () => {
  it('locates missing action implementations before generating a runnable project', () => {
    try {
      collectSourceActionBindings([page()], resolver())
      expect.unreachable('Missing bindings must fail')
    }
    catch (error) {
      expect(error).toBeInstanceOf(SourceActionBindingError)
      expect((error as SourceActionBindingError).diagnostic).toMatchObject({
        code: 'SOURCE_ACTION_BINDING_MISSING',
        pageId: 'home',
        flowId: 'save',
        nodeId: 'action-0',
        path: ['pagesById', 'home', 'flows', 'save', 'nodes', 1, 'ref'],
      })
    }
  })

  it('does not require extra bindings for the shared builtins and registered notify adapter', () => {
    const resolve = vi.fn()
    const result = collectSourceActionBindings([page(['builtin.delay', 'notify'])], resolver(resolve))
    expect(resolve).not.toHaveBeenCalled()
    expect(result.refs).toEqual([])
  })

  it('accepts renderer-local builtins without generated host bindings', async () => {
    const refs = ['builtin.field.set', 'builtin.variable.set', 'builtin.field.state', 'builtin.form.validate', 'builtin.form.submit', 'builtin.form.reset', 'builtin.dataSource.load']
    const resolve = vi.fn()
    const result = collectSourceActionBindings([page(refs)], resolver(resolve))
    expect(result.refs).toEqual([])
    expect(resolve).not.toHaveBeenCalled()
    const load = await createGeneratedModuleLoader({
      ...Object.fromEntries(Object.entries(getConfigFormRuntimeSources()).map(([path, text]) => [`src/runtime/${path}`, text])),
      'src/actions/index.ts': result.module,
    })
    const generated = load('src/actions/index.ts')
    const registry = generated.createSourceFlowActions()
    for (const ref of refs)
      expect(registry.get(ref)).toBeUndefined()
    const fetchHost = vi.fn(async () => new Response('["A"]', { status: 200 }))
    const request = generated.createSourceDataSourceRequest(fetchHost, () => 'https://generated.test/app/page')
    expect(fetchHost).not.toHaveBeenCalled()
    const signal = new AbortController().signal
    expect(await request({ url: '../choices', query: { region: 'US' } }, signal)).toEqual({ ok: true, status: 200, data: ['A'] })
    expect(fetchHost).toHaveBeenCalledWith('https://generated.test/choices?region=US', expect.objectContaining({ signal, method: 'GET' }))
  })

  it('emits one explicit local module import per action and executes its shared registry binding', async () => {
    const binding = localBinding()
    const resolve = vi.fn(() => binding)
    const result = collectSourceActionBindings([page(['host.save', 'host.save'])], resolver(resolve))
    expect(resolve).toHaveBeenCalledOnce()
    expect(result.files['src/actions/save.ts']).toBe(binding.module.kind === 'file' ? binding.module.content : undefined)
    expect(result.module).toContain('import { save as action0 } from "./save"')
    expect(result.module).toContain('"host.save": { execute: action0 }')
    expect(result.refs).toEqual(['host.save'])
    const source = createStandaloneFlowRuntimeSource(page().flows.map(flow => flow.plan))
    const load = await createGeneratedModuleLoader({
      ...Object.fromEntries(Object.entries(getConfigFormRuntimeSources()).map(([path, text]) => [`src/runtime/${path}`, text])),
      ...result.files,
      'src/actions/index.ts': result.module,
      'src/pages/home/flows.ts': source,
    })
    expect(load('src/pages/home/flows.ts').flowPlans).toEqual(page().flows.map(flow => flow.plan))
    const actions = load('src/actions/index.ts').createSourceFlowActions()
    expect(actions.get('host.save').execute({ saved: true })).toEqual({ saved: true })
    expect(actions.get('builtin.delay')).toBeDefined()
  })

  it.each(['../save.ts', 'src/runtime/flow.ts', 'src/actions/index.ts', 'src/actions/../../main.ts'])('rejects unsafe or reserved local path %s', (path) => {
    expect(() => collectSourceActionBindings([page()], resolver(() => localBinding(path))))
      .toThrowError(/under src\/actions/)
  })

  it('rejects filename collisions on case-insensitive filesystems', () => {
    expect(() => collectSourceActionBindings([page(['host.one', 'host.two'])], resolver(ref =>
      localBinding(ref === 'host.one' ? 'src/actions/Save.ts' : 'src/actions/save.ts'))))
      .toThrowError(/conflicting source files/)
  })

  it('carries explicit portable package dependencies into the generated manifest', () => {
    const result = collectSourceActionBindings([page()], resolver(() => ({
      exportName: 'default',
      module: { kind: 'package', packageName: '@example/actions', specifier: '@example/actions/save', version: '1.2.3' },
    })))
    expect(result.module).toContain('import action0 from "@example/actions/save"')
    const manifest = JSON.parse(canonicalProjectPackage('demo', new Map(), result.dependencies))
    expect(manifest.dependencies['@example/actions']).toBe('1.2.3')
  })

  it('rejects nonportable dependencies and imports outside their declared package', () => {
    for (const [specifier, version] of [['other-package', '1.0.0'], ['actions', 'workspace:*']]) {
      expect(() => collectSourceActionBindings([page()], resolver(() => ({
        exportName: 'save',
        module: { kind: 'package', packageName: 'actions', specifier: specifier!, version: version! },
      })))).toThrowError(SourceActionBindingError)
    }
  })

  it('rejects conflicts with standalone runtime dependencies', () => {
    expect(() => canonicalProjectPackage('demo', new Map(), { vue: '2.7.16' }))
      .toThrowError(/conflicts with the standalone runtime version/)
  })
})
