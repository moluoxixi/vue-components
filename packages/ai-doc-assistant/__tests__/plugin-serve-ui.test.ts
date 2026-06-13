import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveUiAsset } from '../src/server/plugin'

/**
 * UI 静态资源路径解析与越界防护单测。
 * 重点：评审发现的同前缀同级目录绕过（dist/ui-backup）必须被拦回 index.html。
 */
describe('resolveUiAsset 越界防护', () => {
  const uiDir = join('/srv', 'app', 'dist', 'ui')

  it('非 UI 前缀返回 null（交还下游）', () => {
    expect(resolveUiAsset(uiDir, '/other/path')).toBeNull()
    expect(resolveUiAsset(uiDir, '/')).toBeNull()
  })

  it('api 前缀返回 null（交还 BFF）', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc/api/health')).toBeNull()
    expect(resolveUiAsset(uiDir, '/__ai-doc/api/query')).toBeNull()
  })

  it('根路径与裸前缀回落 index.html', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc')).toEqual({ rel: 'index.html' })
    expect(resolveUiAsset(uiDir, '/__ai-doc/')).toEqual({ rel: 'index.html' })
  })

  it('合法子资源原样返回相对路径', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc/assets/index-abc.js')).toEqual({
      rel: 'assets/index-abc.js',
    })
    expect(resolveUiAsset(uiDir, '/__ai-doc/index.html')).toEqual({ rel: 'index.html' })
  })

  it('查询串被剥离不影响解析', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc/assets/a.css?v=123')).toEqual({
      rel: 'assets/a.css',
    })
  })

  it('.. 逃逸被拦回 index.html', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc/../../../etc/passwd')).toEqual({
      rel: 'index.html',
    })
    expect(resolveUiAsset(uiDir, '/__ai-doc/../secret.env')).toEqual({ rel: 'index.html' })
  })

  it('同前缀同级目录绕过被拦（dist/ui-backup 回归用例）', () => {
    // 评审发现的 startsWith(uiDir) 缺陷：../ui-backup 会归一到 dist/ui-backup，
    // 仅因名字以 ui 开头而通过旧判定。新逻辑必须回落 index.html。
    expect(resolveUiAsset(uiDir, '/__ai-doc/../ui-backup/secret.js')).toEqual({
      rel: 'index.html',
    })
  })

  it('uRL 编码的 .. 逃逸被拦（%2e%2e）', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc/%2e%2e/%2e%2e/etc/passwd')).toEqual({
      rel: 'index.html',
    })
    expect(resolveUiAsset(uiDir, '/__ai-doc/%2e%2e/ui-backup/secret.js')).toEqual({
      rel: 'index.html',
    })
  })

  it('非法 URL 编码（孤立 %）回落 index.html 不抛错', () => {
    expect(resolveUiAsset(uiDir, '/__ai-doc/%E0%A4%A')).toEqual({ rel: 'index.html' })
  })
})
