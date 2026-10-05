import type { UserConfig } from 'vite'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { createComponentAutoLoadPlugins } from './.vitepress/site/plugins'
import { elementPlusDocsRepositorySnapshotId } from './.vitepress/site/repository/config'

type VitestConfig = UserConfig & { test: Record<string, unknown> }

const config = {
  plugins: [vue(), ...createComponentAutoLoadPlugins()],
  resolve: {
    conditions: ['source'],
    alias: {
      [elementPlusDocsRepositorySnapshotId]: resolve(
        import.meta.dirname,
        'scripts/__tests__/repository-snapshot.fixture.ts',
      ),
    },
  },
  test: {
    include: [
      '.vitepress/**/*.test.ts',
      'scripts/__tests__/**/*.test.ts',
    ],
  },
} satisfies VitestConfig

export default defineConfig(config)
