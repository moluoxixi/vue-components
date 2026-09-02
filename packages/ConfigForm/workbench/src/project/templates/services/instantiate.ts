import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter } from '../../../adapters'
import type { ProjectIdentityFactory } from '../../types'
import type {
  InstantiateTemplatePageInput,
  InstantiateTemplateProjectInput,
  PreparedTemplatePreview,
  ProjectTemplateCatalogEntry,
} from '../types'
import {
  assertProjectDocument,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { DEFAULT_PROJECT_IDENTITY_FACTORY } from '../../defaults'
import { prepareIsolatedProjectPreview, remapProjectPageIdentity } from '../../services'
import { getProjectTemplateSeedFingerprint, registryLockFromSnapshot } from './catalog'

export function instantiateTemplatePage(
  template: ProjectTemplateCatalogEntry,
  input: InstantiateTemplatePageInput,
): ProjectPage {
  const remapped = remapProjectPageIdentity(template.page, input.id, input.identityFactory)
  const page = { ...remapped.page, name: input.name, route: input.route }
  const document = assertProjectDocument({
    version: PROJECT_DOCUMENT_VERSION,
    id: 'template-page-validation',
    name: 'Template page validation',
    homePageId: page.id,
    pageOrder: [page.id],
    pagesById: { [page.id]: page },
    registryLock: { adapter: template.manifest.adapter, version: '1', fingerprint: 'template', components: {} },
    settings: {},
    resources: {},
  })
  return structuredClone(document.pagesById[page.id]!)
}

export function instantiateTemplateProject(
  template: ProjectTemplateCatalogEntry,
  input: InstantiateTemplateProjectInput,
): ProjectDocument {
  const factory = input.identityFactory ?? DEFAULT_PROJECT_IDENTITY_FACTORY
  const projectId = input.id ?? factory.create('project', template.manifest.id)
  const pageId = factory.create('page', template.page.id)
  const page = instantiateTemplatePage(template, {
    id: pageId,
    identityFactory: factory,
    name: input.name,
    route: '/',
  })
  return assertProjectDocument({
    version: PROJECT_DOCUMENT_VERSION,
    id: projectId,
    name: input.name,
    homePageId: page.id,
    pageOrder: [page.id],
    pagesById: { [page.id]: page },
    registryLock: structuredClone(input.registryLock),
    settings: {},
    resources: {},
  })
}

export function prepareTemplatePreview(
  template: ProjectTemplateCatalogEntry,
  adapter: Pick<WorkbenchAdapter, 'designerRegistry' | 'registrySnapshot'>,
  identityFactory?: ProjectIdentityFactory,
): PreparedTemplatePreview {
  const project = instantiateTemplateProject(template, {
    identityFactory,
    name: template.manifest.displayName,
    registryLock: registryLockFromSnapshot(adapter.registrySnapshot),
  })
  return prepareIsolatedProjectPreview({
    adapter,
    adapterId: template.manifest.adapter,
    document: project,
    pageId: project.homePageId,
    revision: `template:${template.manifest.id}:${getProjectTemplateSeedFingerprint(template)}:${project.id}`,
  })
}
