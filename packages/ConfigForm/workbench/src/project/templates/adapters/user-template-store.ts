import type { ProjectTemplateCatalogEntry, ProjectTemplateSeed, TemplateCatalogProvider } from '../types'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { parseProjectTemplateSeed } from '../services/catalog'
import { copyTemplate } from '../services/library'
import { parseTemplateArchive } from '../services/transfer'

/** Templates have their own store and never appear as projects. */
export function createUserTemplateStore(dbName = 'moluoxixi-config-form-template-library') {
  const storage = new IndexDBStorage({ dbName, storeName: 'templates' })

  async function list(): Promise<unknown[]> {
    const keys = await storage.keys()
    const values = await storage.getItems(keys)
    return keys.map(key => values[key]).filter(value => value !== null)
  }

  async function put(template: ProjectTemplateSeed): Promise<ProjectTemplateCatalogEntry> {
    if (!template.manifest.id.startsWith('custom-'))
      throw new TypeError('Built-in templates are read-only. Create a copy to customize them.')
    const parsed = parseProjectTemplateSeed({ manifest: template.manifest, surface: template.surface }, 'personal')
    if ('code' in parsed)
      throw new TypeError(parsed.message)
    await storage.setItem(parsed.manifest.id, parsed)
    return { ...parsed, providerId: 'personal' }
  }

  async function remove(id: string): Promise<void> {
    if (!id.startsWith('custom-'))
      throw new TypeError('Built-in templates are read-only.')
    await storage.removeItem(id)
  }

  async function importArchive(input: unknown): Promise<ProjectTemplateCatalogEntry[]> {
    // Validate the entire archive first. New IDs preserve existing templates,
    // and one IndexedDB transaction prevents partial imports on quota failure.
    const entries = parseTemplateArchive(input).map(entry => copyTemplate(entry, entry.manifest.displayName))
    await storage.setItems(entries.map(entry => ({ key: entry.manifest.id, value: { manifest: entry.manifest, surface: entry.surface } })))
    return entries
  }

  const provider: TemplateCatalogProvider = { id: 'personal', list }
  return { close: () => storage.close(), importArchive, list, provider, put, remove }
}
