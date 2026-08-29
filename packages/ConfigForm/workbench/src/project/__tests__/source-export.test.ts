import type { ConfigFormFlow, ConfigFormFlowConcurrency } from '@moluoxixi/config-form-core'
import type { LowCodePageModel } from '@moluoxixi/config-form-designer'
import { Buffer } from 'node:buffer'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { strFromU8, unzipSync } from 'fflate'
import { transformWithEsbuild } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { applyWorkspaceApplicationOperation, duplicateWorkspacePage } from '../application'
import { createProjectArchive, createWorkspaceArchive } from '../export/archive'
import { createPureSourceExport, createWorkspaceApplicationSourceExport } from '../export/source'
import { normalizeProjectPath } from '../path'
import { createBuiltInWorkspaceApplication, createBuiltInWorkspaceProject } from '../templates'

interface GeneratedFlowModule {
  applyFlowValuePatch: (
    target: Record<string, unknown>,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) => void
  getFlowProjection: () => { props: Record<string, Record<string, unknown>> }
  registerFlowAction: (ref: string, action: (input: unknown) => unknown | Promise<unknown>) => void
  runFlows: (
    trigger: ConfigFormFlow['trigger'],
    values: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<{ status: string, values: Record<string, unknown>, error?: string }>
}

function actionFlow(
  concurrency: ConfigFormFlowConcurrency,
  options: {
    id?: string
    inputField?: string
    onError?: 'end' | 'failure'
    outputField?: string
    projection?: boolean
    timeoutMs?: number
  } = {},
): ConfigFormFlow {
  const nodes: ConfigFormFlow['nodes'] = [
    { id: 'trigger', type: 'trigger' },
    {
      id: 'work',
      type: 'action',
      ref: 'work',
      config: {
        input: { $field: options.inputField ?? 'request' },
        output: { [options.outputField ?? 'result']: { $output: 'work' } },
      },
    },
  ]
  const edges: ConfigFormFlow['edges'] = [
    { id: 'trigger-work', source: 'trigger', target: 'work', condition: 'next' },
  ]
  if (options.onError === 'failure') {
    nodes.push({ id: 'failure', type: 'failure' })
    edges.push({ id: 'work-failure', source: 'work', target: 'failure', condition: 'error' })
  }
  if (options.projection) {
    nodes.push({
      id: 'project',
      type: 'reaction',
      config: {
        reactions: [{
          id: 'project-result',
          when: { kind: 'literal', value: true },
          then: [{
            kind: 'setProps',
            target: 'result',
            props: { placeholder: { kind: 'literal', value: 'Completed' } },
          }],
        }],
      },
    })
    edges.push({ id: 'work-project', source: 'work', target: 'project', condition: 'next' })
  }
  nodes.push({ id: 'end', type: 'end' })
  edges.push({
    id: 'finish',
    source: options.projection ? 'project' : 'work',
    target: 'end',
    condition: 'next',
  })
  return {
    version: 1,
    id: options.id ?? 'generated-flow',
    name: 'Generated flow',
    trigger: { kind: 'field.change', field: 'request' },
    concurrency,
    ...(options.onError || options.timeoutMs
      ? { errorPolicy: { onError: options.onError ?? 'end', ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}) } }
      : {}),
    nodes,
    edges,
  }
}

async function importGeneratedFlowModule(flowOrFlows: ConfigFormFlow | ConfigFormFlow[]): Promise<GeneratedFlowModule> {
  const generatedFlows = Array.isArray(flowOrFlows) ? flowOrFlows : [flowOrFlows]
  const primaryFlow = generatedFlows[0]!
  const project = createBuiltInWorkspaceProject('element-profile', {
    createdAt: '2026-08-27T08:00:00.000Z',
    id: `generated-runtime-${primaryFlow.concurrency ?? 'latest'}`,
    name: 'Generated runtime',
  })
  const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
  model.flows = generatedFlows
  const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
  const exported = createPureSourceExport(project, model, registry)
  const source = (exported.files[normalizeProjectPath('src/flows.ts')] as { content: string }).content
  const transformed = await transformWithEsbuild(source, 'flows.ts', { format: 'esm', loader: 'ts', target: 'es2022' })
  const url = `data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}#${Math.random()}`
  return await import(/* @vite-ignore */ url) as GeneratedFlowModule
}

describe('standalone source export', () => {
  it('generates a routed multi-page Vue application from one Application snapshot', async () => {
    let application = createBuiltInWorkspaceApplication('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'multi-page-source',
      name: 'Multi page source',
    })
    const source = application.pages[0]!
    application = applyWorkspaceApplicationOperation(application, {
      type: 'add-page',
      page: duplicateWorkspacePage(source, { id: 'settings', name: 'Settings', route: '/settings' }),
    })
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createWorkspaceApplicationSourceExport(application, registry)
    const paths = Object.keys(exported.files)

    expect(paths).toEqual(expect.arrayContaining([
      'package.json',
      'src/App.vue',
      'src/main.ts',
      'src/router.ts',
      'src/pages/home/Page.vue',
      'src/pages/home/flows.ts',
      'src/pages/settings/Page.vue',
      'src/pages/settings/flows.ts',
    ]))
    const manifest = JSON.parse((exported.files[normalizeProjectPath('package.json')] as { content: string }).content)
    expect(manifest.dependencies).toEqual({ 'vue': expect.any(String), 'vue-router': '4.5.1' })
    expect(JSON.stringify(exported.files)).not.toMatch(/@moluoxixi\/config-form/)

    const router = (exported.files[normalizeProjectPath('src/router.ts')] as { content: string }).content
    expect(router).toContain('path: "/settings"')
    expect(router).toContain('name: "settings"')
    for (const path of paths.filter(path => path.endsWith('.vue'))) {
      const file = exported.files[normalizeProjectPath(path)]
      expect(file?.kind).toBe('text')
      expect(parseSfc((file as { content: string }).content).errors).toEqual([])
    }

    const archive = unzipSync(await createWorkspaceArchive({ name: application.name, files: exported.files }))
    expect(Object.keys(archive).map(path => path.split('/').slice(1).join('/')).sort()).toEqual(paths.sort())
  })

  it('generates a complete Vue project without ConfigForm runtime imports', async () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-source',
      name: 'Standalone source',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const paths = Object.keys(exported.files)

    expect(paths).toContain('package.json')
    expect(paths).toContain('src/App.vue')
    expect(paths).toContain('src/page.model.json')
    expect(paths).not.toContain('src/form.config.ts')
    expect(paths).not.toContain('src/form.designer.json')

    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content
    const manifest = (exported.files[normalizeProjectPath('package.json')] as { content: string }).content
    expect(app).not.toMatch(/ConfigForm|config-form|form\.config/)
    expect(manifest).not.toMatch(/ConfigForm|config-form|workspace:|catalog:/)
    expect(JSON.parse(manifest).dependencies).toEqual({ vue: expect.any(String) })

    const archive = unzipSync(await createProjectArchive(exported.project))
    expect(Object.keys(archive).map(path => path.split('/').slice(1).join('/')).sort()).toEqual(paths.sort())
    expect(strFromU8(archive[`standalone-source/src/App.vue`]!)).toBe(app)
  })

  it('rejects dynamic model semantics that cannot be represented safely', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-dynamic',
      name: 'Standalone dynamic',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.nodes[0]!.events = { change: [{ action: 'notify', source: 'workflow' }] }
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    expect(() => createPureSourceExport(project, model, registry)).toThrow('dynamic semantics')
  })

  it('projects JSON-only flows into standalone source without ConfigForm dependencies', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-flow',
      name: 'Standalone flow',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.flows = [{
      version: 1,
      id: 'submit-flow',
      name: 'Submit flow',
      trigger: { kind: 'form.submit' },
      nodes: [
        { id: 'trigger', type: 'trigger' },
        { id: 'end', type: 'end' },
      ],
      edges: [{ id: 'next', source: 'trigger', target: 'end', condition: 'next' }],
    }]
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const flows = (exported.files[normalizeProjectPath('src/flows.ts')] as { content: string }).content
    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content
    expect(flows).toContain('submit-flow')
    expect(flows).toContain('runFlows')
    expect(flows).toContain('concurrency?: \'latest\' | \'queue\' | \'ignore\'')
    expect(flows).toContain('activeRuns')
    expect(flows).toContain('flow.errorPolicy?.onError === \'end\'')
    expect(flows).toContain('setProps')
    expect(flows).toContain('setState')
    expect(flows).toContain('effect.kind === \'validate\'')
    expect(app).toContain('import { applyFlowValuePatch, getFlowProjection, runFlows, type FlowTrigger } from \'./flows\'')
    expect(app).toContain('runTrigger({ kind: \'page.mount\' })')
    expect(app).toContain('@change=\'runFieldChange(')
    expect(app).toContain('fieldProps["name"]')
    expect(app).toContain('fieldStates["name"]')
    expect(app).not.toMatch(/ConfigForm|config-form|form\.config/)
  })

  it('executes generated latest flows without waiting for an action that ignored abort', async () => {
    const runtime = await importGeneratedFlowModule(actionFlow('latest'))
    const execute = vi.fn((input: unknown) => input === 'first'
      ? new Promise(() => {})
      : Promise.resolve(input))
    runtime.registerFlowAction('work', execute)
    const first = runtime.runFlows({ kind: 'field.change', field: 'request' }, { request: 'first' })
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))

    const second = runtime.runFlows({ kind: 'field.change', field: 'request' }, { request: 'second' })

    await expect(first).resolves.toMatchObject({ status: 'aborted', values: { request: 'first' } })
    await expect(second).resolves.toMatchObject({ status: 'committed', values: { request: 'second', result: 'second' } })
  })

  it('executes every generated queue run in order and cancels queued revisions immediately', async () => {
    const runtime = await importGeneratedFlowModule(actionFlow('queue'))
    const calls: unknown[] = []
    const releases: Array<(value: unknown) => void> = []
    runtime.registerFlowAction('work', input => new Promise((resolve) => {
      calls.push(input)
      releases.push(resolve)
    }))
    const active = runtime.runFlows({ kind: 'field.change', field: 'request' }, { request: 'active' })
    await vi.waitFor(() => expect(calls).toEqual(['active']))
    const next = runtime.runFlows({ kind: 'field.change', field: 'request' }, { request: 'next' })
    const controller = new AbortController()
    const cancelled = runtime.runFlows(
      { kind: 'field.change', field: 'request' },
      { request: 'cancelled' },
      controller.signal,
    )
    let cancelledSettled = false
    void cancelled.then(() => {
      cancelledSettled = true
    })
    controller.abort('revision-changed')
    await vi.waitFor(() => expect(cancelledSettled).toBe(true))
    await expect(cancelled).resolves.toMatchObject({ status: 'aborted' })

    releases.shift()!('active-result')
    await vi.waitFor(() => expect(calls).toEqual(['active', 'next']))
    releases.shift()!('next-result')
    await expect(active).resolves.toMatchObject({ status: 'committed', values: { result: 'active-result' } })
    await expect(next).resolves.toMatchObject({ status: 'committed', values: { result: 'next-result' } })
  })

  it('keeps a generated ignore flow projection and reports timeouts deterministically', async () => {
    const runtime = await importGeneratedFlowModule(actionFlow('ignore', { projection: true }))
    let release!: (value: unknown) => void
    runtime.registerFlowAction('work', () => new Promise((resolve) => {
      release = resolve
    }))
    const active = runtime.runFlows({ kind: 'field.change', field: 'request' }, { request: 'active' })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))

    await expect(runtime.runFlows(
      { kind: 'field.change', field: 'request' },
      { request: 'ignored' },
    )).resolves.toMatchObject({ status: 'ignored' })
    release('active-result')
    await expect(active).resolves.toMatchObject({ status: 'committed' })
    expect(runtime.getFlowProjection().props).toEqual({ result: { placeholder: 'Completed' } })

    const timeoutRuntime = await importGeneratedFlowModule(actionFlow('latest', { timeoutMs: 5 }))
    timeoutRuntime.registerFlowAction('work', () => new Promise(() => {}))
    await expect(timeoutRuntime.runFlows(
      { kind: 'field.change', field: 'request' },
      { request: 'timeout' },
    )).resolves.toMatchObject({ status: 'timeout', error: 'Flow action timed out.' })
  })

  it('executes generated end and failure error policies like the core interpreter', async () => {
    const endRuntime = await importGeneratedFlowModule(actionFlow('latest', { onError: 'end' }))
    endRuntime.registerFlowAction('work', async () => {
      throw new Error('best effort')
    })
    await expect(endRuntime.runFlows(
      { kind: 'field.change', field: 'request' },
      { request: 'end-policy' },
    )).resolves.toMatchObject({
      error: 'best effort',
      status: 'committed',
      values: { request: 'end-policy' },
    })

    const failureRuntime = await importGeneratedFlowModule(actionFlow('latest', { onError: 'failure', timeoutMs: 5 }))
    failureRuntime.registerFlowAction('work', () => new Promise(() => {}))
    await expect(failureRuntime.runFlows(
      { kind: 'field.change', field: 'request' },
      { request: 'failure-policy' },
    )).resolves.toMatchObject({
      error: 'Flow action timed out.',
      status: 'failure',
      values: { request: 'failure-policy' },
    })
  })

  it('runs generated flows in model order and applies only flow-owned value changes', async () => {
    const runtime = await importGeneratedFlowModule([
      actionFlow('latest', { id: 'first', outputField: 'intermediate' }),
      actionFlow('latest', { id: 'second', inputField: 'intermediate', outputField: 'result' }),
    ])
    const calls: unknown[] = []
    runtime.registerFlowAction('work', async (input) => {
      calls.push(input)
      return `${String(input)}:${calls.length}`
    })

    const result = await runtime.runFlows(
      { kind: 'field.change', field: 'request' },
      { request: 'start', untouched: 'snapshot' },
    )

    expect(calls).toEqual(['start', 'start:1'])
    expect(result).toMatchObject({
      status: 'committed',
      values: {
        intermediate: 'start:1',
        request: 'start',
        result: 'start:1:2',
        untouched: 'snapshot',
      },
    })

    const current = { request: 'newer', result: 'old', untouched: 'newer-user-value' }
    runtime.applyFlowValuePatch(
      current,
      { request: 'start', result: 'old', untouched: 'snapshot' },
      result.values,
    )
    expect(current).toEqual({
      intermediate: 'start:1',
      request: 'newer',
      result: 'start:1:2',
      untouched: 'newer-user-value',
    })
  })

  it('rejects malformed flows before generating a source project', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-invalid-flow',
      name: 'Standalone invalid flow',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.flows = [null] as never
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    expect(() => createPureSourceExport(project, model, registry)).toThrow('Flow must be a JSON object')
  })

  it('preserves explicit null field defaults in the generated model', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-null-default',
      name: 'Standalone null default',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.nodes[0]!.defaultValue = null
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content

    expect(app).toContain('"name": null')
  })

  it('escapes HTML-sensitive JSON values so generated Vue SFCs remain parseable', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-script-value',
      name: 'Standalone script value',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.nodes[0]!.defaultValue = '</script>'
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content

    expect(app).toContain('"name": "\\u003c/script\\u003e"')
    expect(parseSfc(app).errors).toEqual([])
  })
})
