import { describe, expect, it } from 'vitest'
import { WorkspaceProjectError } from '../errors'
import { assertUniqueProjectPaths, normalizeProjectPath, safeProjectSlug } from '../path'
import { commitWorkspaceProject } from '../revision'
import { parseWorkspaceProject } from '../schema'
import { createProjectFixture, NEXT_TIME } from './fixtures'

describe('project paths', () => {
  it('accepts normalized POSIX project files', () => {
    expect(normalizeProjectPath('src/forms/profile.ts')).toBe('src/forms/profile.ts')
    expect(safeProjectSlug('Customer Profile')).toBe('customer-profile')
  })

  it.each([
    '',
    '/src/main.ts',
    'C:/src/main.ts',
    'src\\main.ts',
    'src//main.ts',
    'src/../main.ts',
    'src/\0main.ts',
    'src/CON.ts',
    'src/name. ',
  ])('rejects unsafe project path %j', (path) => {
    expect(() => normalizeProjectPath(path)).toThrow(WorkspaceProjectError)
  })

  it('rejects case-insensitive duplicate paths', () => {
    expect(() => assertUniqueProjectPaths(['src/App.vue', 'src/app.vue'])).toThrow('case normalization')
  })
})

describe('workspace project schema and revision', () => {
  it('normalizes and isolates valid projects', () => {
    const project = createProjectFixture()
    const parsed = parseWorkspaceProject(project)
    project.files[normalizeProjectPath('src/main.ts')] = { content: 'mutated', kind: 'text' }

    expect(parsed.files[normalizeProjectPath('src/main.ts')]).toEqual({ content: 'export {}', kind: 'text', language: 'typescript' })
  })

  it('rejects missing manifest files', () => {
    const project = createProjectFixture({ files: {} })
    expect(() => parseWorkspaceProject(project)).toThrow('manifest references missing file')
  })

  it('creates a monotonic revision without changing identity or creation time', () => {
    const current = createProjectFixture()
    const next = createProjectFixture({ name: 'Renamed', revision: 99 })
    const committed = commitWorkspaceProject(current, 1, next, NEXT_TIME)

    expect(committed).toMatchObject({
      createdAt: current.createdAt,
      id: current.id,
      name: 'Renamed',
      revision: 2,
      updatedAt: NEXT_TIME,
    })
    expect(() => commitWorkspaceProject(current, 0, next, NEXT_TIME)).toThrow('changed from revision 0 to 1')
  })
})
