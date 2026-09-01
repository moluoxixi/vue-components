import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { ProjectIdentityFactory } from '../identity-remap'
import { assertProjectDocument } from '@moluoxixi/config-form-model'
import { DEFAULT_PROJECT_IDENTITY_FACTORY, remapProjectPageIdentity } from '../identity-remap'

export function instantiateImportedPage(
  page: ProjectPage,
  factory: ProjectIdentityFactory = DEFAULT_PROJECT_IDENTITY_FACTORY,
): ProjectPage {
  return remapProjectPageIdentity(page, factory.create('page', page.id), factory).page
}

export function instantiateImportedProject(
  source: ProjectDocument,
  factory: ProjectIdentityFactory = DEFAULT_PROJECT_IDENTITY_FACTORY,
): ProjectDocument {
  const projectId = factory.create('project', source.id)
  const pageIds = new Map(source.pageOrder.map(pageId => [pageId, factory.create('page', pageId)]))
  const pagesById: ProjectDocument['pagesById'] = Object.create(null)
  source.pageOrder.forEach((sourcePageId) => {
    const sourcePage = source.pagesById[sourcePageId]!
    const pageId = pageIds.get(sourcePageId)!
    const page = remapProjectPageIdentity(sourcePage, pageId, factory).page
    pagesById[page.id] = page
  })
  return assertProjectDocument({
    ...structuredClone(source),
    id: projectId,
    homePageId: pageIds.get(source.homePageId),
    pageOrder: source.pageOrder.map(pageId => pageIds.get(pageId)),
    pagesById,
    settings: structuredClone(source.settings),
    resources: structuredClone(source.resources),
  })
}
