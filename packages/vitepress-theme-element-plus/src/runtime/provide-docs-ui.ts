import { provideGlobalConfig } from 'element-plus'
import { docsUiNamespace } from './consumer-namespace'

/** Opt only an owned documentation UI subtree into the theme's EP styles. */
export function provideDocsUi(): void {
  provideGlobalConfig({ namespace: docsUiNamespace })
}
