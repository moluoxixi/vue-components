import type { MonacoWorkerEnvironment } from '../types'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { resolveMonacoWorkerKind } from '../utils'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'
import 'monaco-editor/esm/vs/language/html/monaco.contribution'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution'
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching'
import 'monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions'
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding'
import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions'
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution'
import 'monaco-editor/esm/vs/editor/contrib/links/browser/links'
import 'monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints'
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2'
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController'

let installedEnvironment: MonacoWorkerEnvironment['MonacoEnvironment']

export function installMonacoWorkerEnvironment(): void {
  const environment = globalThis as MonacoWorkerEnvironment
  if (environment.MonacoEnvironment === installedEnvironment)
    return
  const previous = environment.MonacoEnvironment
  const nextEnvironment: NonNullable<MonacoWorkerEnvironment['MonacoEnvironment']> = {
    ...previous,
    getWorker(moduleId: string, label: string) {
      switch (resolveMonacoWorkerKind(label)) {
        case 'html': return new HtmlWorker()
        case 'json': return new JsonWorker()
        case 'typescript': return new TsWorker()
        default: return previous?.getWorker?.(moduleId, label) ?? new EditorWorker()
      }
    },
  }
  environment.MonacoEnvironment = nextEnvironment
  installedEnvironment = nextEnvironment
}
