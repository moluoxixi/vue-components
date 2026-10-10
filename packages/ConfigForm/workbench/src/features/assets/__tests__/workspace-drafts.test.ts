// @vitest-environment happy-dom

import type { AssetManagerCommands } from '../types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { createProjectDocumentFixture } from '../../../project/__tests__/fixtures'
import AssetManagerWorkspace from '../components/AssetManagerWorkspace.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.replaceChildren()
})

function setup() {
  document.body.innerHTML = '<div id="workbench-overlays"></div>'
  const project = shallowRef(createProjectDocumentFixture({
    datasetOrder: ['customers', 'teams'],
    datasetsById: {
      customers: { id: 'customers', name: 'Customers', rows: [{ name: 'Alice' }] },
      teams: { id: 'teams', name: 'Teams', rows: [] },
    },
    resources: { logo: { id: 'logo', name: 'Logo', kind: 'url', url: '/logo.svg' } },
  }))
  const commands = {
    replaceDatasetRows: vi.fn((id: string, rows) => {
      project.value = {
        ...project.value,
        datasetsById: { ...project.value.datasetsById, [id]: { ...project.value.datasetsById[id]!, rows } },
      }
      return true
    }),
    replaceUrlResource: vi.fn((id: string, input) => {
      project.value = {
        ...project.value,
        resources: { ...project.value.resources, [id]: { id, kind: 'url', ...input } },
      }
      return true
    }),
  } as unknown as AssetManagerCommands
  const wrapper = mount(defineComponent({
    setup: () => () => h(AssetManagerWorkspace, { commands, project: project.value }),
  }), { attachTo: document.body })
  wrappers.push(wrapper)
  const editor = wrapper.getComponent(AssetManagerWorkspace)
  const select = async (group: 'Datasets' | 'Resources', index: number) => {
    await wrapper.findAll(`nav[aria-label="${group}"] button`)[index]!.trigger('click')
  }
  const tab = async (name: string) => {
    await wrapper.findAll('[role="tab"]').find(tab => tab.text() === name)!.trigger('click')
  }
  return { wrapper, editor, select, tab, project, commands }
}

describe('shared data workspace drafts', () => {
  it('clears a completed file replacement draft after browsing another asset', async () => {
    const { wrapper, editor, select, project, commands } = setup()
    const file = new File(['replacement'], 'new-logo.svg', { type: 'image/svg+xml' })
    project.value = {
      ...project.value,
      resources: { logo: { id: 'logo', name: 'Logo', kind: 'embedded', fileName: 'logo.svg', mediaType: 'image/svg+xml', byteLength: 1, contentHash: 'sha256:old' } },
    }
    await nextTick()
    await select('Resources', 0)
    const replacement = wrapper.findAllComponents({ name: 'ElUpload' }).find(upload => upload.attributes('data-asset-resource-replacement-file') !== undefined)!
    replacement.props('onChange')!({ raw: file })
    await nextTick()
    let finish!: () => void
    commands.replaceEmbeddedResource = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      project.value = {
        ...project.value,
        resources: { logo: { id: 'logo', name: 'Logo', kind: 'embedded', fileName: file.name, mediaType: file.type, byteLength: file.size, contentHash: 'sha256:new' } },
      }
      return true
    })
    await wrapper.findAll('button').find(button => button.text() === 'Replace file')!.trigger('click')
    await select('Datasets', 1)
    expect(editor.vm.hasChanges).toBe(true)
    finish()
    await flushPromises()
    expect(editor.vm.hasChanges).toBe(false)
    await select('Resources', 0)
    expect(wrapper.get('[data-asset-resource-editor]').text()).toContain(file.name)
    expect(wrapper.find('.asset-manager__pending-file').exists()).toBe(false)
  })

  it('keeps an invalid dataset draft when switching to another asset and tracks it for the leave guard', async () => {
    const { wrapper, editor, select, tab } = setup()
    await tab('JSON')
    await wrapper.get('textarea[aria-label="Dataset JSON"]').setValue('{ unfinished')
    await select('Datasets', 1)
    expect(editor.vm.hasChanges).toBe(true)
    await select('Resources', 0)
    expect(editor.vm.hasChanges).toBe(true)
    await select('Datasets', 0)
    await tab('JSON')
    expect((wrapper.get('textarea[aria-label="Dataset JSON"]').element as HTMLTextAreaElement).value).toBe('{ unfinished')
    await wrapper.findAll('button').find(button => button.text() === 'Discard draft')!.trigger('click')
    expect(editor.vm.hasChanges).toBe(false)
  })

  it('retains resource edits across selection and clears the guard after saving them', async () => {
    const { wrapper, editor, select, commands } = setup()
    await select('Resources', 0)
    await wrapper.get('input[aria-label="Resource URL"]').setValue('/new-logo.svg')
    await select('Datasets', 1)
    expect(editor.vm.hasChanges).toBe(true)
    await select('Resources', 0)
    expect((wrapper.get('input[aria-label="Resource URL"]').element as HTMLInputElement).value).toBe('/new-logo.svg')
    await wrapper.findAll('button').find(button => button.text() === 'Save URL')!.trigger('click')
    await nextTick()
    expect(commands.replaceUrlResource).toHaveBeenCalledWith('logo', expect.objectContaining({ url: '/new-logo.svg' }))
    expect(editor.vm.hasChanges).toBe(false)
    await select('Datasets', 0)
    expect(editor.vm.hasChanges).toBe(false)
  })

  it('tracks drafts on other datasets until they are saved and isolates a different project', async () => {
    const { wrapper, editor, select, tab, project } = setup()
    await tab('JSON')
    await wrapper.get('textarea[aria-label="Dataset JSON"]').setValue('[{"name":"Alicia"}]')
    await select('Datasets', 1)
    expect(editor.vm.hasChanges).toBe(true)
    await select('Datasets', 0)
    await tab('JSON')
    await wrapper.get('[data-asset-dataset-save]').trigger('click')
    await select('Datasets', 1)
    expect(editor.vm.hasChanges).toBe(false)
    await tab('JSON')
    await wrapper.get('textarea[aria-label="Dataset JSON"]').setValue('[{"name":"Other"}]')
    project.value = createProjectDocumentFixture({ id: 'another-project' })
    await nextTick()
    expect(editor.vm.hasChanges).toBe(false)
    expect(wrapper.find('[data-asset-dataset-editor]').exists()).toBe(false)
  })
})
