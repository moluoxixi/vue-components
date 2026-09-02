import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from '@babel/parser'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { transformWithEsbuild } from 'vite'
import { describe, expect, it } from 'vitest'
import { normalizeProjectPath, safeProjectSlug } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createCanonicalProjectConfigExport, createCanonicalProjectSourceExport } from '../export'
import { createBuiltInProjectFixture } from './fixtures'

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
  it('generates a project file and defineField source for every ProjectDocument page', async () => {
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
    expect(pageFile.content).toContain('import { defineFields } from \'@moluoxixi/config-form-headless\'')
    expect(pageFile.content).toContain('const { defineField } = defineFields<PageFormValues>()')
    expect(pageFile.content).toContain('defineField({')
    expect(() => parse(pageFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
  })

  it('rejects a source resolver from another Registry revision', async () => {
    const { adapter, compilation } = await fixture()
    expect(() => createCanonicalProjectConfigExport(compilation, {
      ...adapter.sourceResolver,
      registryFingerprint: 'fnv1a:stale',
    })).toThrow('does not match the ProjectCompilation Registry identity')
  })

  it('preserves graph, relation placement, Registry lock, and Flow authoring metadata', async () => {
    const { adapter, compilation } = await fixture((document) => {
      const page = document.pagesById.home!
      page.graph.props = { authoringSurface: 'customer-profile' }
      page.graph.root[0]!.placement = {
        basis: '42%',
        region: { lane: 'main' },
        span: 7,
      }
      page.flows = [{
        version: 1,
        id: 'positioned-flow',
        name: 'Positioned flow',
        trigger: { kind: 'page.mount' },
        nodes: [
          { id: 'trigger', position: { x: 13, y: 21 }, type: 'trigger' },
          { id: 'end', position: { x: 144, y: 89 }, type: 'end' },
        ],
        edges: [{ id: 'trigger-end', source: 'trigger', target: 'end' }],
      }]
    })
    const exported = createCanonicalProjectConfigExport(compilation, adapter.sourceResolver)
    const pageFile = exported.files[normalizeProjectPath('pages/home/form.config.ts')]
    const projectFile = exported.files[normalizeProjectPath('project.config.ts')]
    expect(pageFile?.kind).toBe('text')
    expect(projectFile?.kind).toBe('text')
    if (pageFile?.kind !== 'text' || projectFile?.kind !== 'text')
      return

    expect(pageFile.content).toContain('export const graph = {')
    expect(pageFile.content).toContain('authoringSurface: "customer-profile"')
    expect(pageFile.content).toContain('placement: {')
    expect(pageFile.content).toContain('basis: "42%"')
    expect(pageFile.content).toContain('lane: "main"')
    expect(pageFile.content).toContain('position: {')
    expect(pageFile.content).toContain('x: 13')
    expect(projectFile.content).toContain('version: 4')
    expect(projectFile.content).toContain('registryLock: {')
    expect(() => parse(pageFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
    expect(() => parse(projectFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
  })
})

describe('canonical standalone Source export', () => {
  it('generates a complete routed Vue project directly from Canonical IR', async () => {
    const { adapter, compilation } = await fixture()
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const paths = Object.keys(exported.files).sort()

    expect(exported.entry).toBe(normalizeProjectPath('src/main.ts'))
    expect(paths).toEqual(expect.arrayContaining([
      'index.html',
      'package.json',
      'src/App.vue',
      'src/main.ts',
      'src/pages/home/Page.vue',
      'src/pages/home/flows.ts',
      'src/pages/home/validation.ts',
      'src/router.ts',
      'src/styles.css',
      'src/vite-env.d.ts',
      'tsconfig.json',
      'vite.config.ts',
    ]))
    expect(JSON.stringify(exported.files)).not.toMatch(/@moluoxixi\/config-form/i)

    const manifest = exported.files[normalizeProjectPath('package.json')]
    expect(manifest?.kind).toBe('text')
    if (manifest?.kind === 'text') {
      expect(JSON.parse(manifest.content).dependencies).toEqual({
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
  })

  it('rejects a Source resolver from another Registry revision', async () => {
    const { adapter, compilation } = await fixture()
    expect(() => createCanonicalProjectSourceExport(compilation, {
      ...adapter.sourceResolver,
      registryFingerprint: 'fnv1a:stale',
    })).toThrow('does not match the ProjectCompilation Registry identity')
  })

  it('binds only node events used by actions or canonical Flow listeners', async () => {
    const { adapter, compilation } = await fixture((document, activeAdapter) => {
      const page = document.pagesById.home!
      document.registryLock.components['element.tabs'] = structuredClone(
        activeAdapter.componentRegistry.lock.components['element.tabs']!,
      )
      document.registryLock.components['element.collapse'] = structuredClone(
        activeAdapter.componentRegistry.lock.components['element.collapse']!,
      )
      page.graph.root.push(
        { nodeId: 'event-tabs', placement: {} },
        { nodeId: 'idle-collapse', placement: {} },
      )
      page.graph.nodesById['event-tabs'] = {
        id: 'event-tabs',
        component: 'element.tabs',
        kind: 'layout',
        props: {},
        events: {},
        bindings: {},
        slots: { default: [] },
      }
      page.graph.nodesById['idle-collapse'] = {
        id: 'idle-collapse',
        component: 'element.collapse',
        kind: 'layout',
        props: {},
        events: {},
        bindings: {},
        slots: { default: [] },
      }
      page.flows = [{
        version: 1,
        id: 'tab-change-flow',
        name: 'Tab change',
        trigger: { kind: 'component.event', nodeId: 'event-tabs', event: 'tab-change' },
        nodes: [
          { id: 'trigger', type: 'trigger' },
          { id: 'end', type: 'end' },
        ],
        edges: [{ id: 'trigger-end', source: 'trigger', target: 'end', condition: 'next' }],
      }]
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const page = exported.files[normalizeProjectPath('src/pages/home/Page.vue')]
    expect(page?.kind).toBe('text')
    if (page?.kind !== 'text')
      return

    expect(page.content).toContain('@tab-change=\'runNodeEvent("event-tabs", "tab-change", $event)\'')
    expect(page.content).not.toContain('runNodeEvent("idle-collapse", "change"')
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
    const validation = exported.files[normalizeProjectPath('src/pages/home/validation.ts')]
    const page = exported.files[normalizeProjectPath('src/pages/home/Page.vue')]
    expect(validation?.kind).toBe('text')
    expect(page?.kind).toBe('text')
    if (validation?.kind !== 'text' || page?.kind !== 'text')
      return

    expect(validation.content).toContain('"validateOn": [\n      "blur",\n      "submit"')
    expect(page.content).toContain('validateOn(field, \'change\')')
    expect(page.content).toContain('validateOn(field, \'blur\')')
    expect(page.content).toContain('await validateRequestedFields(fields)')
    expect(page.content).toContain('fieldErrors["name-field-4"]')

    const transformed = await transformWithEsbuild(validation.content, 'validation.ts', {
      format: 'esm',
      loader: 'ts',
      target: 'es2022',
    })
    const ruleRuntime = pathToFileURL(resolve(
      process.cwd(),
      '../../zod3-to-rule/dist/index.js',
    )).href
    const executable = transformed.code.replaceAll(
      '@moluoxixi/zod3-to-rule',
      ruleRuntime,
    )
    const runtime = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`) as {
      registerFieldValidator: (key: string, validator: (value: unknown) => string | undefined) => void
      validateField: (field: string, values: Record<string, unknown>) => Promise<string[]>
      validateFieldForTrigger: (field: string, trigger: 'blur' | 'change' | 'submit', values: Record<string, unknown>) => Promise<string[] | undefined>
    }
    runtime.registerFieldValidator('available-name', value => value === 'taken' ? 'Name is unavailable' : undefined)

    const nameField = 'name-field-4'
    await expect(runtime.validateField(nameField, { [nameField]: '' })).resolves.toContain('Name is required')
    await expect(runtime.validateField(nameField, { [nameField]: 'ab' })).resolves.toContain('Name is too short')
    await expect(runtime.validateField(nameField, { [nameField]: 'taken' })).resolves.toContain('Name is unavailable')
    await expect(runtime.validateField(nameField, { [nameField]: 'available' })).resolves.toEqual([])
    await expect(runtime.validateFieldForTrigger(nameField, 'change', { [nameField]: '' })).resolves.toBeUndefined()
    await expect(runtime.validateFieldForTrigger(nameField, 'blur', { [nameField]: '' })).resolves.toContain('Name is required')
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
        events: {},
        bindings: {},
        slots: { default: [] },
      }
      document.registryLock.components['element.section'] = structuredClone(
        activeAdapter.componentRegistry.lock.components['element.section']!,
      )
    })
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const page = exported.files[normalizeProjectPath('src/pages/home/Page.vue')]
    const styles = exported.files[normalizeProjectPath('src/styles.css')]
    expect(page?.kind).toBe('text')
    expect(styles?.kind).toBe('text')
    if (page?.kind !== 'text' || styles?.kind !== 'text')
      return

    expect(page.content).toContain('--source-columns-desktop: 24; --source-columns-tablet: 12; --source-columns-mobile: 4')
    expect(page.content).toContain('--source-span-desktop: 8; --source-span-tablet: 6; --source-span-mobile: 4')
    expect(page.content).toContain('"--source-span-desktop": "8"')
    expect(page.content).toContain('"--source-span-tablet": "6"')
    expect(page.content).toContain('"--source-span-mobile": "4"')
    expect(styles.content).toContain('@media (max-width: 1024px)')
    expect(styles.content).toContain('@media (max-width: 720px)')
    expect(styles.content).not.toContain('grid-template-columns: 1fr !important')
  })
})
