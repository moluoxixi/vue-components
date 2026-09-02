import type { ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { PageTransferDocument } from '../types'
import { projectPageSchema, registryLockFingerprint } from '@moluoxixi/config-form-model'
import { PAGE_TRANSFER_VERSION } from '../constants'

export function createPageTransferDocument(
  document: ReadonlyProjectDocument,
  pageId: string,
): PageTransferDocument | undefined {
  const sourcePage = document.pagesById[pageId]
  if (!sourcePage)
    return undefined
  const page = projectPageSchema.parse(structuredClone(sourcePage))
  const componentKeys = new Set(Object.values(page.graph.nodesById).map(node => node.component))
  const components = Object.fromEntries([...componentKeys].map((component) => {
    const contract = document.registryLock.components[component]
    if (!contract)
      throw new Error(`Project Registry lock is missing component "${component}".`)
    return [component, structuredClone(contract)]
  }))
  return {
    kind: 'config-form-page',
    version: PAGE_TRANSFER_VERSION,
    registryLock: {
      adapter: document.registryLock.adapter,
      version: document.registryLock.version,
      fingerprint: registryLockFingerprint(components),
      components,
    },
    page,
  }
}
