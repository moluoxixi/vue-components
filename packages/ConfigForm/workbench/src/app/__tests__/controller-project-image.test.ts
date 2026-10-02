import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import { createProjectEditorSession } from '../../project'
import { createProjectDocumentFixture } from '../../project/__tests__/fixtures'
import { createWorkbenchProjectCommands } from '../services/controller-project-commands'
import { createWorkbenchUiStore } from '../state/ui-store'

async function createHarness(document: ProjectDocument = createProjectDocumentFixture()) {
  const repository = createMemoryProjectRepository()
  const persisted = await repository.create({ document, embeddedContents: [] })
  const session = createProjectEditorSession({ project: persisted, repository })
  const snapshot = shallowRef(session.snapshot)
  session.subscribe(next => snapshot.value = next)
  const ui = createWorkbenchUiStore({})
  const commands = createWorkbenchProjectCommands({
    busy: ref(false),
    closeProject: async () => undefined,
    currentProject: computed(() => snapshot.value.document),
    executeProjectActions: (label, actions, _mergeKey, embeddedWrites) => session.execute({
      id: `project-image-${snapshot.value.editVersion}`,
      label,
      actions,
    }, { embeddedWrites }).changed,
    getPersistenceSession: () => undefined,
    hasUnsavedChanges: computed(() => snapshot.value.dirty),
    openProject: async () => undefined,
    refreshProjects: async () => undefined,
    repository: shallowRef(repository),
    ui,
    workbenchLocale: computed(() => createDesignerLocale()),
  })
  return { commands, repository, session, snapshot }
}

describe('project image commands', () => {
  it('stores image metadata and bytes atomically, then removes the image pointer', async () => {
    const { commands, repository, session, snapshot } = await createHarness()
    const projectId = snapshot.value.document.id
    expect(await commands.setProjectImage(projectId, {
      name: 'Brand mark',
      fileName: 'brand-mark',
      mediaType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    })).toBe(true)

    const resourceId = snapshot.value.document.settings.projectImageResourceId
    expect(typeof resourceId).toBe('string')
    const resource = snapshot.value.document.resources[String(resourceId)]
    expect(resource).toMatchObject({ kind: 'embedded', fileName: 'brand-mark.png', mediaType: 'image/png' })

    const saved = await session.save({ sealHistoryGroup: true, source: 'manual' })
    expect(saved.success).toBe(true)
    if (resource?.kind === 'embedded') {
      await expect(repository.readEmbedded({
        projectId,
        resourceId: resource.id,
        contentHash: resource.contentHash,
      })).resolves.toEqual(new Uint8Array([1, 2, 3]))
    }

    expect(await commands.removeProjectImage(projectId)).toBe(true)
    expect(snapshot.value.document.settings.projectImageResourceId).toBeUndefined()
    expect(snapshot.value.document.resources[String(resourceId)]).toBeUndefined()
  })
})
