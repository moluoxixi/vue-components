import type {
  ProjectDocument,
  ProjectPage,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import { assertProjectDocument } from '@moluoxixi/config-form-model'
import { createBuiltInProject } from '../templates'

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

export function createProjectDocumentFixture(
  overrides: Partial<ProjectDocument> = {},
  adapter: 'antd-vue' | 'element-plus' = 'element-plus',
): ProjectDocument {
  const base = createBuiltInProject(
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
