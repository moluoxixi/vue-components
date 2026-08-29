// @vitest-environment happy-dom

import type { ProjectPath, WorkspaceFile } from '../../project'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { buildProjectFileTree, collectProjectTreeDirectoryIds, normalizeProjectPath } from '../../project'
import ProjectFileTree from '../ProjectFileTree.vue'

function createFiles(): Record<ProjectPath, WorkspaceFile> {
  return {
    [normalizeProjectPath('src/pages/Home.vue')]: { content: '', kind: 'text', language: 'vue' },
    [normalizeProjectPath('src/main.ts')]: { content: '', kind: 'text', language: 'typescript' },
    [normalizeProjectPath('package.json')]: { content: '{}', kind: 'text', language: 'json' },
  }
}

describe('project file tree', () => {
  it('keeps folder expansion and file selection semantics separate', async () => {
    const wrapper = mount(ProjectFileTree, {
      attachTo: document.body,
      props: {
        expandedIds: [],
        nodes: buildProjectFileTree(createFiles()),
        selectedPath: normalizeProjectPath('package.json'),
      },
    })
    const root = wrapper.get('[role="tree"]')
    expect(root.attributes('aria-label')).toBe('Generated source files')
    expect(wrapper.get('[data-project-tree-id="directory:src"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('[data-project-tree-id="file:package.json"]').attributes('aria-selected')).toBe('true')

    await wrapper.get('[data-project-tree-id="directory:src"] .project-file-tree__row').trigger('click')
    expect(wrapper.emitted('update:expandedIds')?.[0]).toEqual([['directory:src']])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('supports roving focus, expansion, child navigation, and selection', async () => {
    const wrapper = mount(ProjectFileTree, {
      attachTo: document.body,
      props: {
        expandedIds: [],
        nodes: buildProjectFileTree(createFiles()),
        selectedPath: normalizeProjectPath('package.json'),
      },
    })
    const directory = wrapper.get('[data-project-tree-id="directory:src"]')
    await directory.trigger('focus')
    await directory.trigger('keydown', { key: 'ArrowRight' })
    await wrapper.setProps({ expandedIds: ['directory:src'] })
    await wrapper.get('[data-project-tree-id="directory:src"]').trigger('keydown', { key: 'ArrowRight' })

    expect(document.activeElement?.getAttribute('data-project-tree-id')).toBe('directory:src/pages')
    await wrapper.get('[data-project-tree-id="directory:src/pages"]').trigger('keydown', { key: 'End' })
    expect(document.activeElement?.getAttribute('data-project-tree-id')).toBe('file:package.json')
    await wrapper.get('[data-project-tree-id="file:package.json"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')?.at(-1)).toEqual([normalizeProjectPath('package.json')])
    wrapper.unmount()
  })

  it('supports prefix typeahead across expanded folders', async () => {
    const nodes = buildProjectFileTree(createFiles())
    const wrapper = mount(ProjectFileTree, {
      attachTo: document.body,
      props: {
        expandedIds: collectProjectTreeDirectoryIds(nodes),
        nodes,
        selectedPath: normalizeProjectPath('package.json'),
      },
    })

    const packageFile = wrapper.get('[data-project-tree-id="file:package.json"]')
    ;(packageFile.element as HTMLElement).focus()
    await packageFile.trigger('keydown', { key: 'h' })
    expect(document.activeElement?.getAttribute('data-project-tree-id')).toBe('file:src/pages/Home.vue')
    wrapper.unmount()
  })
})
