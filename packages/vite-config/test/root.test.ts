import type { Plugin } from 'vite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getBaseConfig } from '@moluoxixi/vite-config'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []

function createProject(dependencies: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-vite-root-'))
  tempDirs.push(root)
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies }),
  )
  return root
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

describe('root aware vite config resolution', () => {
  it('should read dependencies from viteConfig.root instead of process cwd', async () => {
    const root = createProject({
      'vue': '^3.0.0',
      '@vitejs/plugin-vue': '^6.0.0',
    })

    const config = await getBaseConfig({ viteConfig: { root } })
    const flatPlugins = config.plugins!.flat(10).filter(Boolean) as Plugin[]

    expect(flatPlugins.some(plugin => plugin.name === 'vite:vue')).toBe(true)
  })

  it('should report missing runtime dependencies for the selected root', async () => {
    const root = createProject({
      vue: '^3.0.0',
    })

    await expect(getBaseConfig({ viteConfig: { root }, vue: true })).rejects.toThrow(/@vitejs\/plugin-vue/)
  })
})
