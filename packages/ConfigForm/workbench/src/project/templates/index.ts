import type { RegistryLock } from '@moluoxixi/config-form-model'
import type {
  ProjectPageTemplateInput,
  ProjectTemplateCatalogEntry,
  ProjectTemplateInput,
  TemplateIdentityFactory,
  TemplateIdentityKind,
} from './types'
import { WorkbenchProjectError } from '../errors'
import { getBuiltInTemplateSeed } from './built-in-provider'
import { parseProjectTemplateSeed } from './catalog'
import {
  antdProfileTemplate,
  createProjectTemplateRegistry,
  elementProfileTemplate,
} from './create-template'
import { instantiateTemplatePage, instantiateTemplateProject } from './service'

export { builtInTemplateCatalogProvider } from './built-in-provider'
export {
  analyzeTemplateCompatibility,
  createTemplateCatalogService,
  filterTemplateCatalog,
  parseProjectTemplateSeed,
  registryLockFromSnapshot,
} from './catalog'
export { createProjectTemplateRegistry } from './create-template'
export {
  instantiateTemplatePage,
  instantiateTemplateProject,
  prepareTemplatePreview,
} from './service'
export type {
  InstantiateTemplatePageInput,
  InstantiateTemplateProjectInput,
  PreparedTemplatePreview,
  ProjectPageTemplateInput,
  ProjectTemplate,
  ProjectTemplateAdapter,
  ProjectTemplateCatalogEntry,
  ProjectTemplateCategory,
  ProjectTemplateComponentRequirement,
  ProjectTemplateInput,
  ProjectTemplateManifest,
  ProjectTemplateSeed,
  RemappedTemplatePage,
  TemplateCatalogDiagnostic,
  TemplateCatalogDiagnosticCode,
  TemplateCatalogLoadResult,
  TemplateCatalogProvider,
  TemplateCompatibilityInput,
  TemplateCompatibilityResult,
  TemplateCreationTarget,
  TemplateIdentityFactory,
  TemplateIdentityKind,
  TemplateIdentityMap,
} from './types'

export const BUILT_IN_PROJECT_TEMPLATES = createProjectTemplateRegistry([
  elementProfileTemplate,
  antdProfileTemplate,
])

function requireTemplate(templateId: string): ProjectTemplateCatalogEntry {
  if (!BUILT_IN_PROJECT_TEMPLATES.has(templateId))
    throw new WorkbenchProjectError('TEMPLATE_NOT_FOUND', `[config-form-workbench] template "${templateId}" does not exist`)
  const seed = getBuiltInTemplateSeed(templateId)
  const parsed = seed && parseProjectTemplateSeed(seed, 'built-in')
  if (!parsed || 'code' in parsed) {
    throw new WorkbenchProjectError(
      'TEMPLATE_INVALID',
      parsed?.message ?? `[config-form-workbench] template "${templateId}" does not exist`,
    )
  }
  return { providerId: 'built-in', ...parsed }
}

const LEGACY_IDENTITY_FACTORY: TemplateIdentityFactory = Object.freeze({
  create: (_kind: TemplateIdentityKind, source: string) => source,
})

export function createBuiltInProject(
  templateId: string,
  input: ProjectTemplateInput,
  registryLock: RegistryLock,
) {
  const template = requireTemplate(templateId)
  return instantiateTemplateProject(template, {
    id: input.id,
    identityFactory: {
      create: (kind, source) => kind === 'page' ? 'home' : LEGACY_IDENTITY_FACTORY.create(kind, source),
    },
    name: input.name,
    registryLock,
  })
}

export function createBuiltInProjectPage(templateId: string, input: ProjectPageTemplateInput) {
  return instantiateTemplatePage(requireTemplate(templateId), {
    id: input.id,
    identityFactory: LEGACY_IDENTITY_FACTORY,
    name: input.name,
    route: input.route,
  })
}
