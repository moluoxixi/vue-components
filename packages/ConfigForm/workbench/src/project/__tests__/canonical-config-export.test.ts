// @vitest-environment happy-dom
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { ProjectDocument } from '@moluoxixi/config-form-model'
import type { PrototypeSurfaceHostExpose } from '@moluoxixi/config-form-prototype-runtime/vue'
import type { CanonicalProjectSourceExport } from '../export'
import { parse } from '@babel/parser'
import { compileCanonicalProject, getConfigFormRuntimeSources } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeProjectPath, safeProjectSlug } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createCanonicalProjectConfigExport, createCanonicalProjectSourceExport } from '../export'
import { createBuiltInProjectFixture } from './fixtures'
import { createGeneratedModuleLoader } from './generated-runtime-module'

const mountedSurfaces: Array<{ unmount: () => void }> = []
afterEach(() => {
  mountedSurfaces.splice(0).forEach(page => page.unmount())
})

async function generatedSurface(
  exported: CanonicalProjectSourceExport,
  configure?: (load: Awaited<ReturnType<typeof createGeneratedModuleLoader>>) => void,
  initialRoute = '/',
) {
  const load = await createGeneratedModuleLoader(Object.fromEntries(Object.entries(exported.files)
    .filter(([, file]) => file.kind === 'text')
    .map(([path, file]) => [path, file.content as string])))
  configure?.(load)
  const router = load('src/router.ts').router
  await router.push(initialRoute)
  const wrapper = mount(load('src/App.vue').default, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus, router],
      stubs: { teleport: true },
    },
  })
  mountedSurfaces.push(wrapper)
  await flushPromises()
  const renderer = wrapper.findComponent({ name: 'ConfigFormRenderer' })
  if (!renderer.exists())
    throw new Error('Generated project did not mount the active Surface renderer.')
  return {
    wrapper,
    load,
    api: renderer.vm.$.exposed as unknown as ConfigFormRendererExpose,
  }
}

async function fixture(update?: (
  document: ProjectDocument,
  adapter: Awaited<ReturnType<typeof loadWorkbenchAdapter>>,
) => void) {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const document = createBuiltInProjectFixture('element-profile', {
    id: 'canonical-config-project',
    name: 'Canonical config project',
  }, adapter.componentRegistry.lock)
  update?.(document, adapter)
  const result = compileCanonicalProject({
    snapshot: createProjectSnapshot(document, 4),
    registry: adapter.registrySnapshot,
  })
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Compilation failed.')
  return { adapter, compilation: result.compilation }
}

describe('canonical Config export', () => {
  it('generates an executable Canonical Config module for every compiled page', async () => {
    const { adapter, compilation } = await fixture()
    const exported = createCanonicalProjectConfigExport(compilation, adapter.sourceResolver)

    expect(exported.entry).toBe(normalizeProjectPath('project.config.ts'))
    const paths = Object.keys(exported.files).sort()
    expect(paths).toContain('project.config.ts')
    expect(paths.filter(path => path.endsWith('/form.config.ts'))).toHaveLength(
      compilation.snapshot.document.surfaceOrder.length,
    )

    const surfaceId = compilation.snapshot.document.surfaceOrder[0]!
    const surfaceFile = exported.files[normalizeProjectPath(`surfaces/${safeProjectSlug(surfaceId)}/form.config.ts`)]
    expect(surfaceFile?.kind).toBe('text')
    if (surfaceFile?.kind !== 'text')
      return
    expect(surfaceFile.content).toContain('export const surfaceCompilation: SurfaceCompilation = {')
    expect(surfaceFile.content).toContain('export const plan: ConfigFormSurfaceRuntimePlan = {')
    expect(surfaceFile.content).toContain('compileCanonicalSurfaceRuntime({ compilation: surfaceCompilation }, resolver)')
    expect(surfaceFile.content).not.toContain('defineFields')
    expect(() => parse(surfaceFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
  })

  it('rejects a source resolver from another Registry revision', async () => {
    const { adapter, compilation } = await fixture()
    expect(() => createCanonicalProjectConfigExport(compilation, {
      ...adapter.sourceResolver,
      registryFingerprint: 'fnv1a:stale',
    })).toThrow('does not match the ProjectCompilation Registry identity')
  })

  it('preserves canonical graph props, relation placement, and Registry lock', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const page = document.surfacesById.home!
      page.graph.props = { authoringSurface: 'customer-profile' }
      page.graph.root[0]!.placement = {
        basis: '42%',
        region: { lane: 'main' },
        span: 7,
      }
    })
    const exported = createCanonicalProjectConfigExport(compilation, adapter.sourceResolver)
    const surfaceFile = exported.files[normalizeProjectPath('surfaces/home/form.config.ts')]
    const projectFile = exported.files[normalizeProjectPath('project.config.ts')]
    expect(surfaceFile?.kind).toBe('text')
    expect(projectFile?.kind).toBe('text')
    if (surfaceFile?.kind !== 'text' || projectFile?.kind !== 'text')
      return

    expect(surfaceFile.content).toContain('export const surfaceCompilation: SurfaceCompilation = {')
    expect(surfaceFile.content).toContain('authoringSurface: "customer-profile"')
    expect(surfaceFile.content).toContain('placement: {')
    expect(surfaceFile.content).toContain('basis: "42%"')
    expect(surfaceFile.content).toContain('lane: "main"')
    expect(surfaceFile.content).toContain('semanticHash: ')
    expect(projectFile.content).toContain('export const surfaceConfigs = {')
    expect(projectFile.content).toContain('surfaces: [')
    expect(projectFile.content).toContain('irVersion: 5')
    expect(projectFile.content).toContain('registryLock: {')
    expect(() => parse(surfaceFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
    expect(() => parse(projectFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
  })

  it('rejects configuration props that write HTML into generated DOM', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const node = Object.values(document.surfacesById.home!.graph.nodesById)[0]!
      node.props.innerHTML = '<img src=x onerror=alert(1)>'
    })
    expect(() => createCanonicalProjectSourceExport(compilation, adapter.sourceResolver))
      .toThrow('blocked DOM sink prop "innerHTML"')
  })
})

describe('canonical standalone Source export', () => {
  it('generates a complete routed Vue project directly from Canonical IR', async () => {
    const { adapter, compilation } = await fixture()
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const paths = Object.keys(exported.files)

    expect(exported.entry).toBe(normalizeProjectPath('src/main.ts'))
    expect(paths.filter(path => !path.startsWith('src/runtime/'))).toEqual([
      'src/surfaces/home/Surface.vue',
      'src/surfaces/home/validation.ts',
      'index.html',
      'package.json',
      'src/App.vue',
      'src/prototype-context.ts',
      'src/router.ts',
      'src/main.ts',
      'src/styles.css',
      'src/vite-env.d.ts',
      'tsconfig.json',
      'vite.config.ts',
    ])
    expect((exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content)
      .toContain(`from '@moluoxixi/config-form-prototype-runtime/vue'`)
    expect(paths).toContain('src/runtime/expression/services/evaluate.ts')

    const runtimeSources = getConfigFormRuntimeSources()
    expect(paths.filter(path => path.startsWith('src/runtime/'))).toEqual([
      ...Object.keys(runtimeSources).map(path => `src/runtime/${path}`),
      'src/runtime/source-page.ts',
    ])
    for (const [path, content] of Object.entries(runtimeSources))
      expect(exported.files[normalizeProjectPath(`src/runtime/${path}`)]).toMatchObject({ kind: 'text', content })

    const manifest = exported.files[normalizeProjectPath('package.json')]
    expect(manifest?.kind).toBe('text')
    if (manifest?.kind === 'text') {
      expect(JSON.parse(manifest.content).dependencies).toEqual({
        '@lucide/vue': '^1.28.0',
        '@moluoxixi/config-form-prototype-runtime': '^0.1.0',
        '@moluoxixi/zod3-to-rule': '^0.1.2',
        'element-plus': '^2.9.1',
        'vue': expect.any(String),
        'vue-router': '4.5.1',
        'zod': '^3.24.2',
      })
    }

    for (const path of paths.filter(path => path.endsWith('.vue'))) {
      const file = exported.files[normalizeProjectPath(path)]
      expect(file?.kind).toBe('text')
      if (file?.kind === 'text')
        expect(parseSfc(file.content).errors).toEqual([])
    }

    const { wrapper } = await generatedSurface(exported)
    expect(wrapper.get('[data-field]').attributes('data-label-position')).toBe('left')
    const layout = wrapper.get('[data-config-form-responsive-layout]').attributes('style')
    expect(layout).toContain('--mx-config-form-label-width-desktop: 120px')
    expect(layout).toContain('--mx-config-form-label-width-tablet: 96px')
    expect(layout).toContain('--mx-config-form-label-width-mobile: 72px')
    expect(layout).toContain('gap: 16px')
    expect(wrapper.get('[data-field]').attributes('style'))
      .toContain('grid-template-columns: var(--mx-config-form-active-label-width, max-content) minmax(0, 1fr)')
  })

  it('projects form-level readonly into generated field state', async () => {
    const { adapter, compilation } = await fixture((document) => {
      document.surfacesById.home!.graph.form.readonly = true
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const { wrapper, api } = await generatedSurface(exported)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('.mx-config-form__readonly').exists()).toBe(true)
    expect(Object.keys(api.getValues()).length).toBeGreaterThan(0)
  })

  it('preserves page order across generated files and router entries', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const home = document.surfacesById[document.homeSurfaceId]!
      if (home.kind !== 'page')
        throw new Error('Expected the home Surface to be a page.')
      home.route = '/landing'
      const secondary = {
        ...structuredClone(home),
        id: 'secondary',
        name: 'Secondary',
        route: '/secondary',
      }
      document.surfaceOrder.push(secondary.id)
      document.surfacesById[secondary.id] = secondary
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)

    expect(Object.keys(exported.files).filter(path => !path.startsWith('src/runtime/'))).toEqual([
      'src/surfaces/home/Surface.vue',
      'src/surfaces/home/validation.ts',
      'src/surfaces/secondary/Surface.vue',
      'src/surfaces/secondary/validation.ts',
      'index.html',
      'package.json',
      'src/App.vue',
      'src/prototype-context.ts',
      'src/router.ts',
      'src/main.ts',
      'src/styles.css',
      'src/vite-env.d.ts',
      'tsconfig.json',
      'vite.config.ts',
    ])
    const router = exported.files[normalizeProjectPath('src/router.ts')]
    expect(router?.kind).toBe('text')
    if (router?.kind !== 'text')
      return
    expect(router.content).toContain(`{ path: '/', redirect: "/landing" }`)
    expect(router.content.indexOf('name: "home"')).toBeLessThan(router.content.indexOf('name: "secondary"'))

    const main = exported.files[normalizeProjectPath('src/main.ts')]
    expect(main?.kind).toBe('text')
    if (main?.kind === 'text')
      expect(main.content).toContain('await router.isReady()')

    const { wrapper } = await generatedSurface(exported, undefined, '/secondary')
    expect(wrapper.get('.mx-prototype-host__page[data-active="true"]')
      .attributes('data-surface-id')).toBe('secondary')
  })

  it('renders flat Dialog and Drawer assets through the shared Prototype host', async () => {
    let actionNodeId = ''
    const { adapter, compilation } = await fixture((document, activeAdapter) => {
      const home = document.surfacesById.home!
      if (home.kind !== 'page')
        throw new Error('Expected the home Surface to be a page.')
      const activatable = new Set(activeAdapter.registrySnapshot.components
        .filter(component => component.contract.semanticTriggers.includes('activate'))
        .map(component => component.key))
      const actionNode = Object.values(home.graph.nodesById)
        .find(node => activatable.has(node.component))
      if (!actionNode)
        throw new Error('Expected an activatable material in the built-in project.')
      actionNodeId = actionNode.id
      home.interactions = [{
        kind: 'primaryUiAction',
        id: 'open-dialog',
        nodeId: actionNode.id,
        trigger: 'activate',
        action: { kind: 'open', targetSurfaceId: 'dialog', parameters: [] },
      }]
      document.surfaceOrder.push('dialog', 'drawer')
      document.surfacesById.dialog = {
        id: 'dialog',
        name: 'Dialog',
        kind: 'dialog',
        presentation: {
          kind: 'dialog',
          title: 'Edit details',
          width: { desktop: { value: 480, unit: 'px' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        parameters: [],
        outputs: [],
        interactions: [{
          kind: 'primaryUiAction',
          id: 'open-drawer',
          nodeId: actionNode.id,
          trigger: 'activate',
          action: { kind: 'open', targetSurfaceId: 'drawer', parameters: [] },
        }],
        graph: structuredClone(home.graph),
      }
      document.surfacesById.drawer = {
        id: 'drawer',
        name: 'Drawer',
        kind: 'drawer',
        presentation: {
          kind: 'drawer',
          title: 'Inspect details',
          placement: 'right',
          size: { desktop: { value: 40, unit: '%' } },
          mask: true,
          close: { escape: true, mask: true, button: true },
        },
        parameters: [],
        outputs: [],
        interactions: [],
        graph: structuredClone(home.graph),
      }
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)

    expect(Object.keys(exported.files)).toEqual(expect.arrayContaining([
      'src/surfaces/home/Surface.vue',
      'src/surfaces/dialog/Surface.vue',
      'src/surfaces/drawer/Surface.vue',
    ]))
    const router = exported.files[normalizeProjectPath('src/router.ts')]
    expect(router?.kind).toBe('text')
    if (router?.kind !== 'text')
      return
    expect(router.content).toContain('name: "home"')
    expect(router.content).not.toContain('name: "dialog"')
    expect(router.content).not.toContain('name: "drawer"')

    const { wrapper } = await generatedSurface(exported)
    await wrapper.get(`[data-surface-id="home"] [data-config-node-id="${actionNodeId}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.find('.mx-prototype-host__overlay--dialog').exists()).toBe(true)

    const host = wrapper.findComponent({ name: 'PrototypeSurfaceHost' })
    const hostApi = host.vm.$.exposed as unknown as PrototypeSurfaceHostExpose
    const dialogInstanceId = hostApi.getSnapshot().session.overlayStack.at(-1)!
    await hostApi.activate({
      sourceInstanceId: dialogInstanceId,
      sourceAddress: { nodeId: actionNodeId, scope: [] },
      interactionId: 'open-drawer',
    })
    await flushPromises()
    const snapshot = hostApi.getSnapshot()
    expect(snapshot.diagnostics).toEqual([])
    expect(snapshot.session.overlayStack).toHaveLength(2)
    expect(wrapper.find('.mx-prototype-host__overlay--drawer').exists()).toBe(true)
    expect(wrapper.findAll('.mx-prototype-host__overlay-layer').map(layer => layer.attributes('data-surface-id')))
      .toEqual(['dialog', 'drawer'])
  })

  it('rejects a Source resolver from another Registry revision', async () => {
    const { adapter, compilation } = await fixture()
    expect(() => createCanonicalProjectSourceExport(compilation, {
      ...adapter.sourceResolver,
      registryFingerprint: 'fnv1a:stale',
    })).toThrow('does not match the ProjectCompilation Registry identity')
  })

  it('executes required, RuleSet, custom-validator, and validateOn semantics in generated source', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const name = Object.values(document.surfacesById.home!.graph.nodesById)
        .find(node => node.kind === 'field' && node.field === 'name-field-4')
      if (!name || name.kind !== 'field')
        throw new Error('Expected the name field to exist.')
      name.validateOn = 'blur'
      name.validation = {
        version: 1,
        base: { type: 'string' },
        rules: [
          { kind: 'required', message: 'Name is required' },
          { kind: 'minLength', value: 3, message: 'Name is too short' },
          { kind: 'custom', key: 'available-name', message: 'Name is unavailable' },
        ],
      }
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const { wrapper, api, load } = await generatedSurface(exported, (load) => {
      load('src/surfaces/home/validation.ts').registerFieldValidator(
        'available-name',
        (value: unknown) => value === 'taken' ? 'Name is unavailable' : undefined,
      )
    })
    const nameField = 'name-field-4'
    const name = Object.values(compilation.ir.surfacesById.home!.nodesById).find(node => node.kind === 'field' && node.field === nameField)!
    const address = { nodeId: name.id, scope: [] }
    const validation = load('src/surfaces/home/validation.ts')
    expect(Object.values(validation.fieldValidation)).toContainEqual(expect.objectContaining({ validateOn: ['blur', 'submit'] }))
    for (const [value, error] of [['', 'Name is required'], ['ab', 'Name is too short'], ['taken', 'Name is unavailable']]) {
      api.setValues({ [nameField]: value })
      await expect(api.validateField(nameField, 'submit')).resolves.toBe(false)
      expect(api.getInstanceErrors(address)).toContain(error)
      await flushPromises()
      expect(wrapper.get(`[data-field="${nameField}"]`).text()).toContain(error)
    }
    api.setValues({ [nameField]: 'available' })
    await expect(api.validateField(nameField, 'submit')).resolves.toBe(true)
    expect(api.getErrors()).toEqual({})
    api.setValues({ [nameField]: '' })
    await expect(api.validateField(nameField, 'change')).resolves.toBe(true)
    expect(api.getErrors()).toEqual({})
    await expect(api.validateField(nameField, 'blur')).resolves.toBe(false)
    expect(api.getInstanceErrors(address)).toContain('Name is required')
  })

  it('preserves cascading desktop, tablet, and mobile layout for fields and containers', async () => {
    const { adapter, compilation } = await fixture((document, activeAdapter) => {
      const page = document.surfacesById.home!
      page.graph.form = {
        columns: 24,
        fieldSpan: 8,
        responsive: {
          tablet: { columns: 12, fieldSpan: 6 },
          mobile: { columns: 4 },
        },
      }
      delete page.graph.root[0]!.placement.span
      page.graph.root.push({ nodeId: 'responsive-section', placement: {} })
      page.graph.nodesById['responsive-section'] = {
        id: 'responsive-section',
        component: 'element.section',
        kind: 'layout',
        props: { title: 'Responsive section' },
        slots: { default: [] },
      }
      document.registryLock.components['element.section'] = structuredClone(
        activeAdapter.componentRegistry.lock.components['element.section']!,
      )
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const { wrapper } = await generatedSurface(exported)
    const layout = wrapper.get('[data-config-form-responsive-layout]').attributes('style')
    for (const [breakpoint, columns] of [['desktop', 24], ['tablet', 12], ['mobile', 4]])
      expect(layout).toContain(`--mx-config-form-columns-${breakpoint}: ${columns}`)
    const cells = wrapper.findAll('[data-config-form-responsive-cell]')
    for (const cell of [cells[0]!, cells.at(-1)!]) {
      for (const [breakpoint, span] of [['desktop', 8], ['tablet', 6], ['mobile', 4]])
        expect(cell.attributes('style')).toContain(`--mx-config-form-span-${breakpoint}: ${span}`)
    }
    expect(exported.files[normalizeProjectPath('src/runtime/vue/styles/responsive.scss')]?.kind).toBe('text')
    // Raw SCSS is stubbed by Vitest; its media rules and built CSS are verified by the standalone integration test.
  })
})
