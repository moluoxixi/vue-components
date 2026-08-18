import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { createComponentAutoLoadPlugins } from './.vitepress/auto-loaders'
import { docsSite } from './.vitepress/docs-site'
import { repositoryMetadataSnapshotId, repositoryMetadataSnapshotPath } from './.vitepress/repository-metadata-alias'

export default defineConfig({
  plugins: [vue(), ...createComponentAutoLoadPlugins()],
  resolve: {
    conditions: ['source'],
    alias: {
      '@docs-components': fileURLToPath(new URL('../../packages/components/index.ts', import.meta.url)),
      [repositoryMetadataSnapshotId]: repositoryMetadataSnapshotPath(docsSite.metadataProvider),
    },
  },
  test: {
    include: [
      '.vitepress/**/*.test.ts',
      'scripts/__tests__/**/*.test.ts',
    ],
  },
})
