import { createElementPlusDocsRepositoryRuntime } from '@moluoxixi/vitepress-theme-element-plus/repository'
import selectedSnapshot from 'virtual:moluoxixi-repository-metadata-snapshot'
import projectConfig from '../../element-plus-docs.config.ts'
import { docsSite } from './docs-site'

export const docsRepositoryRuntime = createElementPlusDocsRepositoryRuntime({
  project: projectConfig,
  providerOverride: docsSite.metadataProvider,
  snapshot: selectedSnapshot,
})
