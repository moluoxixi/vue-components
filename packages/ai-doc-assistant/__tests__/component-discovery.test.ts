// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { discoverComponentSources } from '../src/core/component-discovery'

const SFC = `<script setup lang="ts">
defineProps<{ label?: string }>()
</script>
<template><div>{{ label }}</div></template>`

let root: string

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value), 'utf8')
}

async function writePackage(packageDir: string, name: string): Promise<void> {
  await mkdir(packageDir, { recursive: true })
  await writeJson(join(packageDir, 'package.json'), {
    exports: {
      '.': {
        source: './index.ts',
      },
    },
    name,
  })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ai-doc-discovery-'))

  const uiDir = join(root, 'packages', 'ui')
  const localDir = join(uiDir, 'src', 'LocalButton')
  const formDir = join(root, 'packages', 'form')

  await writePackage(uiDir, '@scope/ui')
  await writePackage(formDir, '@scope/form')

  await mkdir(join(localDir, 'src'), { recursive: true })
  await mkdir(join(uiDir, 'src', 'Internal', 'src'), { recursive: true })
  await mkdir(join(formDir, 'src', 'components', 'Internal', 'src'), { recursive: true })
  await mkdir(join(formDir, 'src'), { recursive: true })

  await writeFile(join(uiDir, 'index.ts'), `export * from './src'\n`, 'utf8')
  await writeFile(join(uiDir, 'src', 'index.ts'), [
    `export { default as DirectButton } from './DirectButton.vue'`,
    `export { LocalButton } from './LocalButton'`,
    `export { RemoteForm } from '@scope/form'`,
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(uiDir, 'src', 'DirectButton.vue'), SFC, 'utf8')
  await writeFile(join(localDir, 'index.ts'), [
    `import LocalButtonSource from './src/index.vue'`,
    `export const LocalButton = withInstall(LocalButtonSource)`,
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(localDir, 'src', 'index.vue'), SFC, 'utf8')
  await writeFile(join(uiDir, 'src', 'Internal', 'src', 'index.vue'), SFC, 'utf8')

  await writeFile(join(formDir, 'index.ts'), [
    `import RemoteFormSource from './src/index.vue'`,
    `const RemoteFormComponent = RemoteFormSource`,
    `export const remoteForm = withInstall(RemoteFormComponent)`,
    `export const RemoteForm = remoteForm`,
    `export default remoteForm`,
    '',
  ].join('\n'), 'utf8')
  await writeFile(join(formDir, 'src', 'index.vue'), SFC, 'utf8')
  await writeFile(join(formDir, 'src', 'components', 'Internal', 'src', 'index.vue'), SFC, 'utf8')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('component discovery（公共入口扫描）', () => {
  it('按配置入口追踪本地导出、default as 与 workspace re-export，只收公共 SFC', async () => {
    const components = await discoverComponentSources({
      root,
      componentEntries: ['packages/ui/index.ts'],
    })

    expect(components.map(c => c.exportName).sort()).toEqual([
      'DirectButton',
      'LocalButton',
      'RemoteForm',
    ])
    expect(components.every(c => c.packageName === '@scope/ui')).toBe(true)
    expect(components.map(c => c.filePath).join('\n')).not.toContain('Internal')
  })

  it('未配置且多个 package public entry 都导出组件时直接 FAIL，要求显式配置入口', async () => {
    await expect(discoverComponentSources({ root }))
      .rejects
      .toThrow(/multiple component package entries found/)
  })

  it('配置入口没有公共 Vue 组件时直接 FAIL', async () => {
    const docsDir = join(root, 'packages', 'docs')
    await writePackage(docsDir, '@scope/docs')
    await writeFile(join(docsDir, 'index.ts'), `export const version = '1.0.0'\n`, 'utf8')

    await expect(discoverComponentSources({
      root,
      componentEntries: ['packages/docs/index.ts'],
    })).rejects.toThrow(/no public Vue components exported from configured entries/)
  })

  it('配置入口中任一 re-export 断链时直接 FAIL，不返回部分成功结果', async () => {
    await writeFile(join(root, 'packages', 'ui', 'src', 'index.ts'), [
      `export { default as DirectButton } from './DirectButton.vue'`,
      `export { MissingButton } from './MissingButton'`,
      '',
    ].join('\n'), 'utf8')

    await expect(discoverComponentSources({
      root,
      componentEntries: ['packages/ui/index.ts'],
    })).rejects.toThrow(/cannot resolve module ".\/MissingButton"/)
  })

  it('未配置且只有一个 package public entry 导出组件时可自动识别', async () => {
    const singleRoot = join(root, 'single')
    const packageDir = join(singleRoot, 'packages', 'single-ui')
    await writePackage(packageDir, '@scope/single-ui')
    await mkdir(join(packageDir, 'src'), { recursive: true })
    await writeFile(join(packageDir, 'index.ts'), `export { default as OnlyButton } from './src/index.vue'\n`, 'utf8')
    await writeFile(join(packageDir, 'src', 'index.vue'), SFC, 'utf8')

    const components = await discoverComponentSources({ root: singleRoot })

    expect(components).toHaveLength(1)
    expect(components[0]).toMatchObject({
      exportName: 'OnlyButton',
      packageName: '@scope/single-ui',
    })
  })
})
