import type { WorkspaceFile } from '../types'
import { describe, expect, it } from 'vitest'
import {
  buildProjectFileTree,
  collectProjectTreeDirectoryIds,
  flattenVisibleProjectTree,
  projectFileIconKind,
} from '../file-tree'
import { normalizeProjectPath } from '../path'

function text(content = ''): WorkspaceFile {
  return { content, kind: 'text' }
}

describe('project file tree', () => {
  it('builds stable directory-first nested nodes', () => {
    const files = {
      [normalizeProjectPath('vite.config.ts')]: text(),
      [normalizeProjectPath('src/pages/Home.vue')]: text(),
      [normalizeProjectPath('src/main.ts')]: text(),
      [normalizeProjectPath('package.json')]: text(),
    }
    const tree = buildProjectFileTree(files)

    expect(tree.map(node => `${node.kind}:${node.name}`)).toEqual([
      'directory:src',
      'file:package.json',
      'file:vite.config.ts',
    ])
    expect(tree[0]).toMatchObject({
      children: [
        { kind: 'directory', name: 'pages' },
        { kind: 'file', name: 'main.ts' },
      ],
      kind: 'directory',
      name: 'src',
    })
  })

  it('rejects file and directory path conflicts regardless of insertion order', () => {
    expect(() => buildProjectFileTree({
      [normalizeProjectPath('src')]: text(),
      [normalizeProjectPath('src/main.ts')]: text(),
    })).toThrow('conflicts with a file')
    expect(() => buildProjectFileTree({
      [normalizeProjectPath('src/main.ts')]: text(),
      [normalizeProjectPath('src')]: text(),
    })).toThrow('conflicts with a directory')
  })

  it('flattens only expanded directories with parent and level metadata', () => {
    const tree = buildProjectFileTree({
      [normalizeProjectPath('src/pages/Home.vue')]: text(),
      [normalizeProjectPath('src/main.ts')]: text(),
    })
    const directoryIds = collectProjectTreeDirectoryIds(tree)

    expect(directoryIds).toEqual(['directory:src', 'directory:src/pages'])
    expect(flattenVisibleProjectTree(tree, new Set(['directory:src'])).map(entry => ({
      id: entry.node.id,
      level: entry.level,
      parentId: entry.parentId,
    }))).toEqual([
      { id: 'directory:src', level: 1, parentId: undefined },
      { id: 'directory:src/pages', level: 2, parentId: 'directory:src' },
      { id: 'file:src/main.ts', level: 2, parentId: 'directory:src' },
    ])
  })

  it('maps common file kinds to stable icons', () => {
    expect(projectFileIconKind(normalizeProjectPath('src/App.vue'), text())).toBe('code')
    expect(projectFileIconKind(normalizeProjectPath('package.json'), text())).toBe('json')
    expect(projectFileIconKind(normalizeProjectPath('README.md'), text())).toBe('text')
    expect(projectFileIconKind(normalizeProjectPath('logo.png'), { content: new Uint8Array(), kind: 'binary' })).toBe('binary')
  })
})
