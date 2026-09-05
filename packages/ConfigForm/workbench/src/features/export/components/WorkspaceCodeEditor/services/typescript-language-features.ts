import type { editor, IDisposable } from 'monaco-editor'
import type {
  TypeScriptCompletionDetails,
  TypeScriptCompletionInfo,
  TypeScriptDisplayPart,
  TypeScriptQuickInfo,
  VueTypeScriptCompletionItem,
} from '../types'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import {
  WORKBENCH_CONFIG_TYPE_DECLARATIONS,
  WORKBENCH_CONFIG_TYPES_URI,
  WORKBENCH_MODULES,
  WORKBENCH_TYPE_DECLARATIONS,
  WORKBENCH_TYPES_URI,
} from '../constants'
import {
  createVueTypeScriptMirror,
  findModuleSpecifierContext,
  isOffsetInVueScript,
  mergeWorkbenchModules,
} from '../utils'

type OwnLanguageFeature = (disposable: IDisposable) => void

const modelModuleNames = new WeakMap<editor.ITextModel, readonly string[]>()
const vueScriptMirrors = new WeakMap<editor.ITextModel, editor.ITextModel>()
let typeScriptWorkerFactoryPromise: ReturnType<typeof monaco.languages.typescript.getTypeScriptWorker> | undefined

export function setModelModuleNames(model: editor.ITextModel, moduleNames: readonly string[]): void {
  modelModuleNames.set(model, moduleNames)
}

function completionRange(model: editor.ITextModel, position: monaco.Position): monaco.IRange {
  const word = model.getWordUntilPosition(position)
  return {
    endColumn: word.endColumn,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    startLineNumber: position.lineNumber,
  }
}

function moduleCompletionItems(
  model: editor.ITextModel,
  position: monaco.Position,
  includeDeclaredModules = true,
): monaco.languages.CompletionItem[] {
  const context = findModuleSpecifierContext(model.getValue(), model.getOffsetAt(position))
  if (!context)
    return []

  const start = model.getPositionAt(context.startOffset)
  const end = model.getPositionAt(context.endOffset)
  const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
  const projectModules = modelModuleNames.get(model) ?? []
  const modules = includeDeclaredModules
    ? mergeWorkbenchModules(projectModules)
    : projectModules.filter(moduleName => !WORKBENCH_MODULES.includes(moduleName as typeof WORKBENCH_MODULES[number]))
  return modules
    .filter(moduleName => moduleName.startsWith(context.typed))
    .map(moduleName => ({
      detail: 'Workbench module',
      insertText: moduleName,
      kind: monaco.languages.CompletionItemKind.Module,
      label: moduleName,
      range,
    }))
}

function vueTypeScriptMirrorUri(model: editor.ITextModel): monaco.Uri {
  return monaco.Uri.parse(`${model.uri.toString()}.ts`)
}

function ensureVueTypeScriptMirror(sourceModel: editor.ITextModel): editor.ITextModel {
  const current = vueScriptMirrors.get(sourceModel)
  if (current && !current.isDisposed())
    return current

  const uri = vueTypeScriptMirrorUri(sourceModel)
  const mirrorValue = createVueTypeScriptMirror(sourceModel.getValue())
  const mirror = monaco.editor.getModel(uri) ?? monaco.editor.createModel(mirrorValue, 'typescript', uri)
  if (mirror.getLanguageId() !== 'typescript')
    monaco.editor.setModelLanguage(mirror, 'typescript')
  if (mirror.getValue() !== mirrorValue)
    mirror.setValue(mirrorValue)

  const changeSubscription = sourceModel.onDidChangeContent(() => {
    const value = createVueTypeScriptMirror(sourceModel.getValue())
    if (!mirror.isDisposed() && mirror.getValue() !== value)
      mirror.setValue(value)
  })
  const disposeSubscription = sourceModel.onWillDispose(() => {
    changeSubscription.dispose()
    disposeSubscription.dispose()
    vueScriptMirrors.delete(sourceModel)
    if (!mirror.isDisposed())
      mirror.dispose()
  })
  vueScriptMirrors.set(sourceModel, mirror)
  return mirror
}

function displayPartsToString(parts: TypeScriptDisplayPart[] | undefined): string {
  return parts?.map(part => part.text).join('') ?? ''
}

function tagToString(tag: { name: string, text?: string | TypeScriptDisplayPart[] }): string {
  const text = Array.isArray(tag.text) ? displayPartsToString(tag.text) : tag.text
  return text ? `*@${tag.name}* ${text}` : `*@${tag.name}*`
}

function documentationToString(value: {
  documentation?: TypeScriptDisplayPart[]
  tags?: Array<{ name: string, text?: string | TypeScriptDisplayPart[] }>
}): string {
  return [
    displayPartsToString(value.documentation),
    ...(value.tags?.map(tagToString) ?? []),
  ].filter(Boolean).join('\n\n')
}

function typeScriptCompletionKind(kind: string): monaco.languages.CompletionItemKind {
  switch (kind) {
    case 'keyword':
    case 'primitive type':
      return monaco.languages.CompletionItemKind.Keyword
    case 'const':
    case 'let':
    case 'local var':
    case 'var':
      return monaco.languages.CompletionItemKind.Variable
    case 'class':
      return monaco.languages.CompletionItemKind.Class
    case 'enum':
      return monaco.languages.CompletionItemKind.Enum
    case 'function':
    case 'method':
      return monaco.languages.CompletionItemKind.Function
    case 'interface':
      return monaco.languages.CompletionItemKind.Interface
    case 'module':
      return monaco.languages.CompletionItemKind.Module
    case 'property':
    case 'getter':
    case 'setter':
      return monaco.languages.CompletionItemKind.Field
    default:
      return monaco.languages.CompletionItemKind.Property
  }
}

function getWorkbenchTypeScriptWorkerFactory(): ReturnType<typeof monaco.languages.typescript.getTypeScriptWorker> {
  typeScriptWorkerFactoryPromise ??= monaco.languages.typescript.getTypeScriptWorker().catch(async (error) => {
    if (String(error) !== 'TypeScript not registered!')
      throw error

    const { setupTypeScript } = await import('monaco-editor/esm/vs/language/typescript/tsMode')
    setupTypeScript(monaco.languages.typescript.typescriptDefaults)
    return monaco.languages.typescript.getTypeScriptWorker()
  })
  return typeScriptWorkerFactoryPromise
}

export function resetTypeScriptLanguageFeatures(): void {
  typeScriptWorkerFactoryPromise = undefined
}

export async function warmVueTypeScriptWorker(model: editor.ITextModel): Promise<void> {
  const mirror = ensureVueTypeScriptMirror(model)
  const getWorker = await getWorkbenchTypeScriptWorkerFactory()
  await getWorker(mirror.uri)
}

export async function warmTypeScriptWorker(model: editor.ITextModel): Promise<void> {
  const getWorker = await getWorkbenchTypeScriptWorkerFactory()
  await getWorker(model.uri)
}

async function provideTypeScriptCompletions(
  model: editor.ITextModel,
  position: monaco.Position,
  token: monaco.CancellationToken,
  mirror = model,
): Promise<monaco.languages.CompletionList | undefined> {
  const offset = model.getOffsetAt(position)
  const getWorker = await getWorkbenchTypeScriptWorkerFactory()
  const worker = await getWorker(mirror.uri)
  if (token.isCancellationRequested || model.isDisposed() || mirror.isDisposed())
    return undefined

  const info = await worker.getCompletionsAtPosition(mirror.uri.toString(), offset) as TypeScriptCompletionInfo | undefined
  if (!info || token.isCancellationRequested || model.isDisposed())
    return undefined

  const defaultRange = completionRange(model, position)
  const entries = [...new Map(info.entries.map(entry => [entry.name, entry])).values()]
  return {
    suggestions: entries.map((entry): VueTypeScriptCompletionItem => {
      let range: monaco.IRange = defaultRange
      if (entry.replacementSpan) {
        const start = model.getPositionAt(entry.replacementSpan.start)
        const end = model.getPositionAt(entry.replacementSpan.start + entry.replacementSpan.length)
        range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
      }
      return {
        insertText: entry.name,
        kind: typeScriptCompletionKind(entry.kind),
        label: entry.name,
        range,
        sortText: entry.sortText,
        tags: entry.kindModifiers?.includes('deprecated')
          ? [monaco.languages.CompletionItemTag.Deprecated]
          : undefined,
        typeScriptEntry: {
          mirrorUri: mirror.uri.toString(),
          name: entry.name,
          offset,
        },
      }
    }),
  }
}

async function provideVueTypeScriptCompletions(
  model: editor.ITextModel,
  position: monaco.Position,
  token: monaco.CancellationToken,
): Promise<monaco.languages.CompletionList | undefined> {
  const offset = model.getOffsetAt(position)
  if (!isOffsetInVueScript(model.getValue(), offset))
    return undefined
  return provideTypeScriptCompletions(model, position, token, ensureVueTypeScriptMirror(model))
}

async function resolveVueTypeScriptCompletion(
  item: monaco.languages.CompletionItem,
  token: monaco.CancellationToken,
): Promise<monaco.languages.CompletionItem> {
  const completion = item as VueTypeScriptCompletionItem
  if (!completion.typeScriptEntry)
    return item

  const uri = monaco.Uri.parse(completion.typeScriptEntry.mirrorUri)
  const getWorker = await getWorkbenchTypeScriptWorkerFactory()
  const worker = await getWorker(uri)
  if (token.isCancellationRequested)
    return item

  const details = await worker.getCompletionEntryDetails(
    uri.toString(),
    completion.typeScriptEntry.offset,
    completion.typeScriptEntry.name,
  ) as TypeScriptCompletionDetails | undefined
  if (!details || token.isCancellationRequested)
    return item

  const documentation = documentationToString(details)
  return {
    ...item,
    detail: displayPartsToString(details.displayParts),
    documentation: documentation ? { value: documentation } : item.documentation,
    kind: typeScriptCompletionKind(details.kind),
    label: details.name,
  }
}

async function queryTypeScriptHover(
  model: editor.ITextModel,
  position: monaco.Position,
  token: monaco.CancellationToken,
  mirror = model,
): Promise<monaco.languages.Hover | undefined> {
  const offset = model.getOffsetAt(position)
  const getWorker = await getWorkbenchTypeScriptWorkerFactory()
  const worker = await getWorker(mirror.uri)
  if (token.isCancellationRequested || model.isDisposed() || mirror.isDisposed())
    return undefined

  const info = await worker.getQuickInfoAtPosition(mirror.uri.toString(), offset) as TypeScriptQuickInfo | undefined
  if (!info || token.isCancellationRequested || model.isDisposed())
    return undefined

  const start = model.getPositionAt(info.textSpan.start)
  const end = model.getPositionAt(info.textSpan.start + info.textSpan.length)
  const type = displayPartsToString(info.displayParts)
  const documentation = documentationToString(info)
  return {
    contents: [
      { value: `\`\`\`typescript\n${type}\n\`\`\`` },
      ...(documentation ? [{ value: documentation }] : []),
    ],
    range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
  }
}

async function provideVueTypeScriptHover(
  model: editor.ITextModel,
  position: monaco.Position,
  token: monaco.CancellationToken,
): Promise<monaco.languages.Hover | undefined> {
  const offset = model.getOffsetAt(position)
  if (!isOffsetInVueScript(model.getValue(), offset))
    return undefined
  return queryTypeScriptHover(model, position, token, ensureVueTypeScriptMirror(model))
}

export function configureTypeScriptLanguageDefaults(ownLanguageFeature: OwnLanguageFeature): void {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    allowSyntheticDefaultImports: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    target: monaco.languages.typescript.ScriptTarget.Latest,
  })
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
  ownLanguageFeature(monaco.languages.typescript.typescriptDefaults.addExtraLib(WORKBENCH_TYPE_DECLARATIONS, WORKBENCH_TYPES_URI))
  ownLanguageFeature(monaco.languages.typescript.typescriptDefaults.addExtraLib(
    WORKBENCH_CONFIG_TYPE_DECLARATIONS,
    WORKBENCH_CONFIG_TYPES_URI,
  ))
}

export function registerTypeScriptLanguageProviders(ownLanguageFeature: OwnLanguageFeature): void {
  ownLanguageFeature(monaco.languages.registerCompletionItemProvider('typescript', {
    triggerCharacters: ['\'', '"', '{', ','],
    provideCompletionItems(model, position) {
      const source = model.getValue()
      const offset = model.getOffsetAt(position)
      if (findModuleSpecifierContext(source, offset))
        return { suggestions: moduleCompletionItems(model, position, false) }

      const range = completionRange(model, position)
      const beforeCursor = source.slice(0, offset)
      const suggestions: monaco.languages.CompletionItem[] = []
      if (/\bfields\s*=\s*\[[\s\S]*$/.test(beforeCursor)) {
        suggestions.push({
          documentation: 'Create a typed ConfigForm field with the bound defineField helper.',
          insertText: [
            'defineField({',
            '  component: "' + '$' + '{1:text}",',
            '  field: "' + '$' + '{2:name}",',
            '  label: "' + '$' + '{3:Name}",',
            '  span: ' + '$' + '{4:24},',
            '})',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          kind: monaco.languages.CompletionItemKind.Snippet,
          label: 'ConfigForm field',
          range,
        })
      }
      if (source.trim() === '') {
        suggestions.push({
          documentation: 'Create a complete public ConfigForm module.',
          insertText: `import { defineFields } from '@moluoxixi/config-form-headless'

interface PageFormValues {
  name: string
}

const { defineField } = defineFields<PageFormValues>()

export const form = { columns: 24, fieldSpan: 24 }
export const initialValues: PageFormValues = { name: '' }
export const fields = [
  defineField({ component: 'text', field: 'name', label: 'Name' }),
]`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          kind: monaco.languages.CompletionItemKind.Snippet,
          label: 'ConfigForm module',
          range,
        })
      }
      return { suggestions }
    },
  }))

  ownLanguageFeature(monaco.languages.registerCompletionItemProvider('vue', {
    triggerCharacters: ['.', '\'', '"', '{', ','],
    async provideCompletionItems(model, position, _context, token) {
      const source = model.getValue()
      const offset = model.getOffsetAt(position)
      if (findModuleSpecifierContext(source, offset))
        return { suggestions: moduleCompletionItems(model, position, true) }
      if (source.trim() === '') {
        return {
          suggestions: [{
            documentation: 'Vue single-file component page skeleton.',
            insertText: [
              '<script setup lang="ts">',
              '$' + '{1}',
              '</scr' + 'ipt>',
              '',
              '<template>',
              '  <main class="page-shell">',
              '    ' + '$' + '{2}',
              '  </main>',
              '</template>',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Snippet,
            label: 'Vue SFC page',
            range: completionRange(model, position),
          }],
        }
      }
      return provideVueTypeScriptCompletions(model, position, token)
    },
    resolveCompletionItem: resolveVueTypeScriptCompletion,
  }))
  ownLanguageFeature(monaco.languages.registerHoverProvider('vue', {
    provideHover: provideVueTypeScriptHover,
  }))
}
