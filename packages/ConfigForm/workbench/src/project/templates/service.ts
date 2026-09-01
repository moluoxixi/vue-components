import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter } from '../../adapters'
import type {
  InstantiateTemplatePageInput,
  InstantiateTemplateProjectInput,
  PreparedTemplatePreview,
  ProjectTemplateCatalogEntry,
  TemplateIdentityFactory,
} from './types'
import { compileCanonicalPage } from '@moluoxixi/config-form-compiler'
import {
  assertProjectDocument,
  createProjectSnapshot,
  PROJECT_DOCUMENT_VERSION,
} from '@moluoxixi/config-form-model'
import { DEFAULT_TEMPLATE_IDENTITY_FACTORY, remapTemplatePageIdentity } from '../identity-remap'
import { registryLockFromSnapshot } from './catalog'

export function instantiateTemplatePage(
  template: ProjectTemplateCatalogEntry,
  input: InstantiateTemplatePageInput,
): ProjectPage {
  const remapped = remapTemplatePageIdentity(template.page, input.id, input.identityFactory)
  const page = { ...remapped.page, name: input.name, route: input.route }
  const document = assertProjectDocument({
    schemaVersion: PROJECT_DOCUMENT_VERSION,
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
  const factory = input.identityFactory ?? DEFAULT_TEMPLATE_IDENTITY_FACTORY
  const projectId = input.id ?? factory.create('project', template.manifest.id)
  const pageId = factory.create('page', template.page.id)
  const page = instantiateTemplatePage(template, {
    id: pageId,
    identityFactory: factory,
    name: input.name,
    route: '/',
  })
  return assertProjectDocument({
    schemaVersion: PROJECT_DOCUMENT_VERSION,
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

function initialValues(page: ProjectPage): Record<string, unknown> {
  return Object.fromEntries(Object.values(page.graph.nodesById)
    .filter(node => node.kind === 'field' && node.defaultValue !== undefined)
    .map(node => [node.kind === 'field' ? node.field : '', structuredClone(node.kind === 'field' ? node.defaultValue : undefined)]))
}

export function prepareTemplatePreview(
  template: ProjectTemplateCatalogEntry,
  adapter: Pick<WorkbenchAdapter, 'designerRegistry' | 'registrySnapshot'>,
  identityFactory?: TemplateIdentityFactory,
): PreparedTemplatePreview {
  const project = instantiateTemplateProject(template, {
    identityFactory,
    name: template.manifest.displayName,
    registryLock: registryLockFromSnapshot(adapter.registrySnapshot),
  })
  const snapshot = createProjectSnapshot(project, 0)
  const compiled = compileCanonicalPage({
    snapshot: {
      document: snapshot.document,
      editVersion: snapshot.editVersion,
      contentHash: snapshot.contentHash,
    },
    pageId: project.homePageId,
    registry: adapter.registrySnapshot,
  })
  if (!compiled.success)
    throw new TypeError(`${compiled.diagnostics[0]?.code ?? 'TEMPLATE_PREVIEW_COMPILE_FAILED'}: ${compiled.diagnostics[0]?.message ?? 'Template preview compilation failed.'}`)
  const values = initialValues(project.pagesById[project.homePageId]!)
  const reactionProjection: ConfigFormReactionProjection<Record<string, unknown>> = {
    values: structuredClone(values),
    props: {},
    states: {},
    validate: [],
  }
  const revision = `template:${template.manifest.id}:${template.manifest.version}:${project.id}`
  return {
    adapter: template.manifest.adapter,
    compilation: compiled.compilation,
    namespace: adapter.designerRegistry.rendererNamespace,
    reactionProjection,
    revision,
    runtimeSessionKey: `${project.id}:${template.manifest.adapter}:${project.homePageId}`,
    runtimeState: { values, touched: [], validation: {} },
  }
}
