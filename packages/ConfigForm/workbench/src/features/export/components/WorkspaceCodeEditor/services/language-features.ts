import type { IDisposable } from 'monaco-editor'
import {
  configureTypeScriptLanguageDefaults,
  registerTypeScriptLanguageProviders,
  resetTypeScriptLanguageFeatures,
} from './typescript-language-features'
import {
  configureWorkbenchHtmlDefaults,
  registerVueLanguageDefinition,
} from './vue-language-definition'

export {
  setModelModuleNames,
  warmTypeScriptWorker,
  warmVueTypeScriptWorker,
} from './typescript-language-features'

let languageFeaturesConfigured = false
let languageFeatureDisposers: IDisposable[] = []

function ownLanguageFeature(disposable: IDisposable): void {
  languageFeatureDisposers.push(disposable)
}

export function disposeMonacoLanguageFeatures(): void {
  for (const disposable of languageFeatureDisposers.reverse())
    disposable.dispose()
  languageFeatureDisposers = []
  languageFeaturesConfigured = false
  resetTypeScriptLanguageFeatures()
}

export function configureLanguageFeatures(): void {
  if (languageFeaturesConfigured)
    return
  languageFeaturesConfigured = true

  registerVueLanguageDefinition()
  configureTypeScriptLanguageDefaults(ownLanguageFeature)
  configureWorkbenchHtmlDefaults()
  registerTypeScriptLanguageProviders(ownLanguageFeature)
}

if (import.meta.hot)
  import.meta.hot.dispose(disposeMonacoLanguageFeatures)
