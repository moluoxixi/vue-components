import type { SourceFile } from '../../generator'
import { describe, expect, it } from 'vitest'
import {
  buildSourceFileTree,
  collectSourceDirectoryIds,
  decodedBase64ByteLength,
  flattenVisibleSourceTree,
} from '../services'

describe('source viewer file tree', () => {
  const files: SourceFile[] = [
    { content: '', kind: 'text', language: 'vue', path: 'src/views/Home.vue' },
    { content: '', kind: 'text', language: 'typescript', path: 'src/main.ts' },
    { content: '{}', kind: 'text', language: 'json', path: 'package.json' },
  ]

  it('builds a stable directory-first tree and flattens only expanded branches', () => {
    const tree = buildSourceFileTree(files)
    expect(tree.map(node => node.path)).toEqual(['src', 'package.json'])
    expect(collectSourceDirectoryIds(tree)).toEqual(['directory:src', 'directory:src/views'])
    expect(flattenVisibleSourceTree(tree, new Set(['directory:src'])).map(entry => entry.node.path)).toEqual([
      'src',
      'src/views',
      'src/main.ts',
      'package.json',
    ])
  })

  it('calculates canonical base64 payload sizes without decoding bytes', () => {
    expect(decodedBase64ByteLength('')).toBe(0)
    expect(decodedBase64ByteLength('AA==')).toBe(1)
    expect(decodedBase64ByteLength('AAE=')).toBe(2)
    expect(decodedBase64ByteLength('AAEC')).toBe(3)
  })
})
