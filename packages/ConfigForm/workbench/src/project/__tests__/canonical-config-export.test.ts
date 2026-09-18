// @vitest-environment happy-dom
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { ProjectDocument } from '@moluoxixi/config-form-model'
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

const mountedPages: Array<{ unmount: () => void }> = []
afterEach(() => {
  mountedPages.splice(0).forEach(page => page.unmount())
})

async function generatedPage(
  exported: CanonicalProjectSourceExport,
  configure?: (load: Awaited<ReturnType<typeof createGeneratedModuleLoader>>) => void,
) {
  const load = await createGeneratedModuleLoader(Object.fromEntries(Object.entries(exported.files)
    .filter(([, file]) => file.kind === 'text')
    .map(([path, file]) => [path, file.content as string])))
  configure?.(load)
  const wrapper = mount(load('src/pages/home/Page.vue').default, { global: { plugins: [ElementPlus] } })
  mountedPages.push(wrapper)
  await flushPromises()
  return { wrapper, load, api: wrapper.vm as unknown as ConfigFormRendererExpose }
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
      compilation.snapshot.document.pageOrder.length,
    )

    const pageId = compilation.snapshot.document.pageOrder[0]!
    const pageFile = exported.files[normalizeProjectPath(`pages/${safeProjectSlug(pageId)}/form.config.ts`)]
    expect(pageFile?.kind).toBe('text')
    if (pageFile?.kind !== 'text')
      return
    expect(pageFile.content).toContain('export const pageCompilation: PageCompilation = {')
    expect(pageFile.content).toContain('export const plan: ConfigFormPageRuntimePlan = {')
    expect(pageFile.content).toContain('compileCanonicalPageRuntime({ compilation: pageCompilation }, resolver)')
    expect(pageFile.content).not.toContain('defineFields')
    expect(() => parse(pageFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
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
      const page = document.pagesById.home!
      page.graph.props = { authoringSurface: 'customer-profile' }
      page.graph.root[0]!.placement = {
        basis: '42%',
        region: { lane: 'main' },
        span: 7,
      }
    })
    const exported = createCanonicalProjectConfigExport(compilation, adapter.sourceResolver)
    const pageFile = exported.files[normalizeProjectPath('pages/home/form.config.ts')]
    const projectFile = exported.files[normalizeProjectPath('project.config.ts')]
    expect(pageFile?.kind).toBe('text')
    expect(projectFile?.kind).toBe('text')
    if (pageFile?.kind !== 'text' || projectFile?.kind !== 'text')
      return

    expect(pageFile.content).toContain('export const pageCompilation: PageCompilation = {')
    expect(pageFile.content).toContain('authoringSurface: "customer-profile"')
    expect(pageFile.content).toContain('placement: {')
    expect(pageFile.content).toContain('basis: "42%"')
    expect(pageFile.content).toContain('lane: "main"')
    expect(pageFile.content).toContain('semanticHash: ')
    expect(projectFile.content).toContain('export const pageConfigs = {')
    expect(projectFile.content).toContain('version: 5')
    expect(projectFile.content).toContain('registryLock: {')
    expect(() => parse(pageFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
    expect(() => parse(projectFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
  })

  it('rejects configuration props that write HTML into generated DOM', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const node = Object.values(document.pagesById.home!.graph.nodesById)[0]!
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
      'src/data/index.ts',
      'src/pages/home/Page.vue',
      'src/pages/home/validation.ts',
      'index.html',
      'package.json',
      'src/App.vue',
      'src/router.ts',
      'src/main.ts',
      'src/styles.css',
      'src/vite-env.d.ts',
      'tsconfig.json',
      'vite.config.ts',
    ])
    expect(JSON.stringify(exported.files)).not.toMatch(/@moluoxixi\/config-form/i)
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

    const { wrapper } = await generatedPage(exported)
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
      document.pagesById.home!.graph.form.readonly = true
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const { wrapper, api } = await generatedPage(exported)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('.mx-config-form__readonly').exists()).toBe(true)
    expect(Object.keys(api.getValues()).length).toBeGreaterThan(0)
  })

  it('preserves page order across generated files and router entries', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const home = document.pagesById[document.homePageId]!
      home.route = '/landing'
      const secondary = {
        ...structuredClone(home),
        id: 'secondary',
        name: 'Secondary',
        route: '/secondary',
      }
      document.pageOrder.push(secondary.id)
      document.pagesById[secondary.id] = secondary
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)

    expect(Object.keys(exported.files).filter(path => !path.startsWith('src/runtime/'))).toEqual([
      'src/data/index.ts',
      'src/pages/home/Page.vue',
      'src/pages/home/validation.ts',
      'src/pages/secondary/Page.vue',
      'src/pages/secondary/validation.ts',
      'index.html',
      'package.json',
      'src/App.vue',
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
      const name = Object.values(document.pagesById.home!.graph.nodesById)
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
    const { wrapper, api, load } = await generatedPage(exported, (load) => {
      load('src/pages/home/validation.ts').registerFieldValidator(
        'available-name',
        (value: unknown) => value === 'taken' ? 'Name is unavailable' : undefined,
      )
    })
    const nameField = 'name-field-4'
    const name = Object.values(compilation.ir.pagesById.home!.nodesById).find(node => node.kind === 'field' && node.field === nameField)!
    const address = { nodeId: name.id, scope: [] }
    const validation = load('src/pages/home/validation.ts')
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
      const page = document.pagesById.home!
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
        bindings: {},
        slots: { default: [] },
      }
      document.registryLock.components['element.section'] = structuredClone(
        activeAdapter.componentRegistry.lock.components['element.section']!,
      )
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const { wrapper } = await generatedPage(exported)
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
