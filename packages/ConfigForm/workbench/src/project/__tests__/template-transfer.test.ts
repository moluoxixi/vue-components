import { describe, expect, it } from 'vitest'
import { copyTemplate, createBlankTemplate, createTemplateCatalogService, createUserTemplateStore, parseTemplateArchive, serializeTemplateArchive } from '..'
import 'fake-indexeddb/auto'

describe('personal template backups', () => {
  it('round trips both adapters and imports as independent copies without overwriting existing IDs', async () => {
    const store = createUserTemplateStore(`backup-${crypto.randomUUID()}`)
    try {
      const entries = [copyTemplate(createBlankTemplate('element-plus', 'page'), '个人表单'), copyTemplate(createBlankTemplate('antd-vue', 'drawer'), '个人抽屉')]
      await store.put(entries[0]!)
      const archive = JSON.parse(serializeTemplateArchive(entries))
      expect(archive.templates[0]).not.toHaveProperty('providerId')
      const imported = await store.importArchive(archive)
      expect(imported.map(entry => entry.manifest.id)).not.toContain(entries[0]!.manifest.id)
      expect(imported.map(entry => entry.surface)).toEqual(entries.map(entry => entry.surface))
      expect((await createTemplateCatalogService([store.provider]).load()).diagnostics).toEqual([])
      expect(await store.list()).toHaveLength(3)
      expect(parseTemplateArchive(JSON.parse(serializeTemplateArchive(imported)))).toHaveLength(2)
    }
    finally { store.close() }
  })
  it('validates the complete archive before any writes', async () => {
    const store = createUserTemplateStore(`backup-${crypto.randomUUID()}`)
    try {
      const entry = copyTemplate(createBlankTemplate('element-plus', 'page'), 'Keep')
      await store.put(entry)
      const archive = JSON.parse(serializeTemplateArchive([entry]))
      archive.templates.push({ invalid: true })
      await expect(store.importArchive(archive)).rejects.toThrow()
      expect(await store.list()).toHaveLength(1)
      expect(() => parseTemplateArchive({ ...archive, version: 2 })).toThrow()
      expect(() => parseTemplateArchive({ ...archive, templates: [archive.templates[0], archive.templates[0]] })).toThrow('Duplicate')
    }
    finally { store.close() }
  })
})
