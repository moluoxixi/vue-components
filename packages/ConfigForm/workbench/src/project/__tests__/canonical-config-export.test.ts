import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { parse } from '@babel/parser'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import { createCanonicalProjectConfigExport } from '../export/config'
import { createCanonicalProjectSourceExport } from '../export/source'
import { normalizeProjectPath, safeProjectSlug } from '../path'
import { createBuiltInProject } from '../templates'

async function fixture(update?: (
  document: ProjectDocument,
  adapter: Awaited<ReturnType<typeof loadWorkbenchAdapter>>,
) => void) {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const document = createBuiltInProject('element-profile', {
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
    expect(projectFile.content).toContain('schemaVersion: 4')
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
        'element-plus': '2.9.1',
        'vue': expect.any(String),
        'vue-router': '4.5.1',
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
})
