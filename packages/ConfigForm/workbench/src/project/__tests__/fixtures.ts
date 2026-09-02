import type {
  ProjectDocument,
  ProjectPage,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import { assertProjectDocument } from '@moluoxixi/config-form-model'
import {
  getBuiltInTemplateSeed,
  instantiateTemplateProject,
  parseProjectTemplateSeed,
} from '../templates'

export const FIXED_TIME = '2026-08-27T08:00:00.000Z'

export function createRegistryLockFixture(adapter: 'antd-vue' | 'element-plus' = 'element-plus'): RegistryLock {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  return {
    adapter,
    version: '1.0.0',
    fingerprint: `fnv1a:${adapter}`,
    components: Object.fromEntries(['input', 'select', 'switch'].map(name => [
      `${prefix}.${name}`,
      { contractVersion: '1', fingerprint: `fnv1a:${prefix}-${name}` },
    ])),
  }
}

export function createBuiltInProjectFixture(
  templateId: 'antd-profile' | 'element-profile',
  input: { id: string, name: string },
  registryLock: RegistryLock,
): ProjectDocument {
  const seed = getBuiltInTemplateSeed(templateId)
  const parsed = seed && parseProjectTemplateSeed(seed, 'built-in')
  if (!parsed || 'code' in parsed)
    throw new Error(parsed?.message ?? `Unknown built-in template: ${templateId}`)
  let sequence = 0
  return instantiateTemplateProject({ providerId: 'built-in', ...parsed }, {
    id: input.id,
    identityFactory: {
      create: (kind, source) => kind === 'page' ? 'home' : `${source}-${kind}-${++sequence}`,
    },
    name: input.name,
    registryLock,
  })
}

export function createProjectDocumentFixture(
  overrides: Partial<ProjectDocument> = {},
  adapter: 'antd-vue' | 'element-plus' = 'element-plus',
): ProjectDocument {
  const base = createBuiltInProjectFixture(
    adapter === 'element-plus' ? 'element-profile' : 'antd-profile',
    { id: 'project', name: 'Fixture project' },
    createRegistryLockFixture(adapter),
  )
  return assertProjectDocument({ ...base, ...structuredClone(overrides) })
}

export function duplicateProjectPage(page: ProjectPage, id: string, name: string, route: string): ProjectPage {
  return {
    ...structuredClone(page),
    id,
    name,
    route,
  }
}
