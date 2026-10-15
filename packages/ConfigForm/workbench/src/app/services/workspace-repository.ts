import type { ProjectRepository } from '@moluoxixi/config-form-model'
import type { HttpProjectRepository } from '@moluoxixi/config-form-studio/client'
import { openHttpProjectRepository } from '@moluoxixi/config-form-studio/client'
import { createIndexedDBProjectRecoveryDraftStore, createMemoryProjectRecoveryDraftStore, openDefaultProjectRepository } from '../../project'

export function isHttpWorkbenchRepository(repository: ProjectRepository): repository is HttpProjectRepository {
  return 'subscribeChanges' in repository && 'workspaceId' in repository
}

export async function discoverWorkspaceUrl(location: Pick<Location, 'href' | 'origin'> = window.location, metadata = document.querySelector<HTMLMetaElement>('meta[name="config-form-workspace"]')?.content): Promise<string | undefined> {
  const explicit = new URL(location.href).searchParams.get('workspace')
  if (explicit) {
    const url = new URL(explicit)
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw new TypeError('Workspace connection must be a local HTTP service origin.')
    return url.origin
  }
  if (!metadata)
    return undefined
  if (metadata !== location.origin)
    throw new TypeError('Workspace connection config does not match this designer origin.')
  return metadata
}

export async function openWorkbenchProjectRepository(): Promise<ProjectRepository> {
  const url = await discoverWorkspaceUrl()
  // An explicitly connected workspace never falls back to browser storage.
  return url ? await openHttpProjectRepository({ url }) : await openDefaultProjectRepository({})
}

export function createWorkbenchRecoveryDraftStore(repository: ProjectRepository) {
  return repository.persistence === 'durable'
    ? createIndexedDBProjectRecoveryDraftStore(isHttpWorkbenchRepository(repository) ? { dbName: `config-form-drafts:${encodeURIComponent(repository.workspaceId)}` } : undefined)
    : createMemoryProjectRecoveryDraftStore()
}
