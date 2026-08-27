<script setup lang="ts">
import type { editor, IDisposable } from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import {
  createVueTypeScriptMirror,
  findModuleSpecifierContext,
  isOffsetInVueScript,
  mergeWorkbenchModules,
  resolveMonacoWorkerKind,
  WORKBENCH_CONFIG_TYPE_DECLARATIONS,
  WORKBENCH_CONFIG_TYPES_URI,
  WORKBENCH_MODULES,
  WORKBENCH_TYPE_DECLARATIONS,
  WORKBENCH_TYPES_URI,
} from './workspace-editor-language'

interface Props {
  filename: string
  language?: string
  moduleNames?: readonly string[]
  modelValue: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  language: 'plaintext',
  readonly: false,
})
const emit = defineEmits<{
  save: []
  'update:modelValue': [value: string]
}>()
const containerRef = useTemplateRef<HTMLElement>('container')
const models = new Map<string, editor.ITextModel>()
const modelModuleNames = new WeakMap<editor.ITextModel, readonly string[]>()
const cursorLine = ref(1)
const cursorColumn = ref(1)
let codeEditor: editor.IStandaloneCodeEditor | undefined
let changeSubscription: IDisposable | undefined
let cursorSubscription: IDisposable | undefined
let resizeObserver: ResizeObserver | undefined
const languageLabel = computed(() => {
  const labels: Record<string, string> = {
    html: 'HTML',
    json: 'JSON',
    plaintext: 'Plain Text',
    typescript: 'TypeScript',
    vue: 'Vue',
  }
  return labels[props.language] ?? props.language
})

type MonacoWorkerEnvironment = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (moduleId: string, label: string) => Worker
  }
}

const monacoWorkerEnvironment = globalThis as MonacoWorkerEnvironment
const previousMonacoEnvironment = monacoWorkerEnvironment.MonacoEnvironment
monacoWorkerEnvironment.MonacoEnvironment = {
  ...previousMonacoEnvironment,
  getWorker(_moduleId, label) {
    switch (resolveMonacoWorkerKind(label)) {
      case 'html':
        return new HtmlWorker()
      case 'json':
        return new JsonWorker()
      case 'typescript':
        return new TsWorker()
      default:
        return previousMonacoEnvironment?.getWorker?.(_moduleId, label) ?? new EditorWorker()
    }
  },
}

let languageFeaturesConfigured = false
const vueScriptMirrors = new WeakMap<editor.ITextModel, editor.ITextModel>()
let typeScriptWorkerFactoryPromise: ReturnType<typeof monaco.languages.typescript.getTypeScriptWorker> | undefined

interface TypeScriptDisplayPart {
  text: string
}

interface TypeScriptTextSpan {
  length: number
  start: number
}

interface TypeScriptCompletionEntry {
  kind: string
  kindModifiers?: string
  name: string
  replacementSpan?: TypeScriptTextSpan
  sortText: string
}

interface TypeScriptCompletionInfo {
  entries: TypeScriptCompletionEntry[]
}

interface TypeScriptCompletionDetails {
  displayParts?: TypeScriptDisplayPart[]
  documentation?: TypeScriptDisplayPart[]
  kind: string
  name: string
  tags?: Array<{ name: string, text?: string | TypeScriptDisplayPart[] }>
}

interface TypeScriptQuickInfo {
  displayParts?: TypeScriptDisplayPart[]
  documentation?: TypeScriptDisplayPart[]
  tags?: Array<{ name: string, text?: string | TypeScriptDisplayPart[] }>
  textSpan: TypeScriptTextSpan
}

interface VueTypeScriptCompletionItem extends monaco.languages.CompletionItem {
  typeScriptEntry?: {
    mirrorUri: string
    name: string
    offset: number
  }
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

async function warmVueTypeScriptWorker(model: editor.ITextModel): Promise<void> {
  const mirror = ensureVueTypeScriptMirror(model)
  const getWorker = await getWorkbenchTypeScriptWorkerFactory()
  await getWorker(mirror.uri)
}

async function warmTypeScriptWorker(model: editor.ITextModel): Promise<void> {
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

function configureLanguageFeatures(): void {
  if (languageFeaturesConfigured)
    return
  languageFeaturesConfigured = true

  monaco.languages.register({ extensions: ['.vue'], id: 'vue' })
  monaco.languages.setLanguageConfiguration('vue', {
    autoClosingPairs: [
      { close: '}', open: '{' },
      { close: ']', open: '[' },
      { close: ')', open: '(' },
      { close: '"', open: '"' },
      { close: '\'', open: '\'' },
      { close: '`', open: '`' },
      { close: '>', open: '<' },
    ],
    brackets: [['<', '>'], ['{', '}'], ['[', ']'], ['(', ')']],
    comments: { blockComment: ['<!--', '-->'] },
    surroundingPairs: [
      { close: '}', open: '{' },
      { close: ']', open: '[' },
      { close: ')', open: '(' },
      { close: '"', open: '"' },
      { close: '\'', open: '\'' },
      { close: '`', open: '`' },
      { close: '>', open: '<' },
    ],
  })
  monaco.languages.setMonarchTokensProvider('vue', {
    tokenizer: {
      root: [
        [/(<script\b)([^>]*)(>)/i, [
          { next: '@script', token: 'tag' },
          'attribute.name',
          { nextEmbedded: 'typescript', token: 'tag' },
        ]],
        [/(<style\b)([^>]*)(>)/i, [
          { next: '@style', token: 'tag' },
          'attribute.name',
          { nextEmbedded: 'css', token: 'tag' },
        ]],
        [/(<template\b)([^>]*)(>)/i, [
          { next: '@template', token: 'tag' },
          'attribute.name',
          { nextEmbedded: 'html', token: 'tag' },
        ]],
        [/<!--/, 'comment', '@comment'],
        [/[^<]+/, ''],
        [/<[^>]+>/, 'tag'],
      ],
      script: [
        [/<\/script\s*>/i, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      style: [
        [/<\/style\s*>/i, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      template: [
        [/<\/template\s*>/i, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      comment: [
        [/-->/, 'comment', '@pop'],
        [/./, 'comment'],
      ],
    },
  })
  monaco.languages.html.registerHTMLLanguageService('vue', {
    data: {
      dataProviders: {
        configForm: {
          tags: [
            {
              attributes: [
                { description: 'Bound page model.', name: 'v-model' },
                { description: 'ConfigForm field declarations.', name: ':fields' },
                { description: 'Grid column count.', name: ':columns' },
                { description: 'Default field span.', name: ':field-span' },
                { description: 'Render fields inline.', name: 'inline' },
                { description: 'Render the form as readonly.', name: 'readonly' },
              ],
              description: 'ConfigForm renderer using Element Plus components.',
              name: 'ElementConfigForm',
            },
            {
              attributes: [
                { description: 'Bound page model.', name: 'v-model' },
                { description: 'ConfigForm field declarations.', name: ':fields' },
                { description: 'Grid column count.', name: ':columns' },
                { description: 'Default field span.', name: ':field-span' },
                { description: 'Render fields inline.', name: 'inline' },
                { description: 'Render the form as readonly.', name: 'readonly' },
              ],
              description: 'ConfigForm renderer using Ant Design Vue components.',
              name: 'AntdConfigForm',
            },
          ],
          version: 1.1,
        },
      },
      useDefaultDataProvider: true,
    },
    suggest: { html5: true },
  }, {
    completionItems: true,
    documentFormattingEdits: true,
    documentHighlights: true,
    documentSymbols: true,
    foldingRanges: true,
    hovers: true,
    links: true,
    rename: true,
    selectionRanges: true,
  })

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    allowSyntheticDefaultImports: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    target: monaco.languages.typescript.ScriptTarget.Latest,
  })
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
  monaco.languages.typescript.typescriptDefaults.addExtraLib(WORKBENCH_TYPE_DECLARATIONS, WORKBENCH_TYPES_URI)
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    WORKBENCH_CONFIG_TYPE_DECLARATIONS,
    WORKBENCH_CONFIG_TYPES_URI,
  )
  monaco.languages.html.htmlDefaults.setOptions({
    data: {
      dataProviders: {
        configForm: {
          tags: [
            {
              attributes: [
                { description: 'Bound page model.', name: 'v-model' },
                { description: 'ConfigForm field declarations.', name: ':fields' },
                { description: 'Grid column count.', name: ':columns' },
                { description: 'Default field span.', name: ':field-span' },
                { description: 'Render fields inline.', name: 'inline' },
                { description: 'Render the form as readonly.', name: 'readonly' },
              ],
              description: 'ConfigForm renderer using Element Plus components.',
              name: 'ElementConfigForm',
            },
            {
              attributes: [
                { description: 'Bound page model.', name: 'v-model' },
                { description: 'ConfigForm field declarations.', name: ':fields' },
                { description: 'Grid column count.', name: ':columns' },
                { description: 'Default field span.', name: ':field-span' },
                { description: 'Render fields inline.', name: 'inline' },
                { description: 'Render the form as readonly.', name: 'readonly' },
              ],
              description: 'ConfigForm renderer using Ant Design Vue components.',
              name: 'AntdConfigForm',
            },
          ],
          version: 1.1,
        },
      },
      useDefaultDataProvider: true,
    },
    suggest: {
      html5: true,
    },
  })

  monaco.languages.registerCompletionItemProvider('typescript', {
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
      return {
        suggestions,
      }
    },
  })

  monaco.languages.registerCompletionItemProvider('vue', {
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
  })
  monaco.languages.registerHoverProvider('vue', {
    provideHover: provideVueTypeScriptHover,
  })
}

function editorLanguage(language: string): string {
  return language
}

function modelUri(filename: string): monaco.Uri {
  return monaco.Uri.parse(`inmemory://config-form-workbench/${encodeURI(filename)}`)
}

function getModel(): editor.ITextModel {
  const existing = models.get(props.filename)
  if (existing) {
    monaco.editor.setModelLanguage(existing, editorLanguage(props.language))
    modelModuleNames.set(existing, props.moduleNames ?? [])
    return existing
  }
  const model = monaco.editor.createModel(
    props.modelValue,
    editorLanguage(props.language),
    modelUri(props.filename),
  )
  models.set(props.filename, model)
  modelModuleNames.set(model, props.moduleNames ?? [])
  return model
}

function bindModel(): void {
  if (!codeEditor)
    return
  changeSubscription?.dispose()
  const model = getModel()
  if (model.getValue() !== props.modelValue)
    model.setValue(props.modelValue)
  if (props.language === 'vue') {
    void warmVueTypeScriptWorker(model).catch((error) => {
      console.error('Failed to initialize the Vue TypeScript language service.', error)
    })
  }
  else if (props.language === 'typescript') {
    void warmTypeScriptWorker(model).catch((error) => {
      console.error('Failed to initialize the TypeScript language service.', error)
    })
  }
  codeEditor.setModel(model)
  changeSubscription = model.onDidChangeContent(() => emit('update:modelValue', model.getValue()))
}

onMounted(() => {
  const container = containerRef.value
  if (!container)
    return
  configureLanguageFeatures()
  codeEditor = monaco.editor.create(container, {
    automaticLayout: false,
    bracketPairColorization: { enabled: true },
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    fixedOverflowWidgets: true,
    folding: true,
    foldingHighlight: true,
    foldingStrategy: 'auto',
    fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
    fontLigatures: true,
    fontSize: 13,
    glyphMargin: true,
    guides: {
      bracketPairs: true,
      bracketPairsHorizontal: true,
      highlightActiveBracketPair: true,
      highlightActiveIndentation: true,
      indentation: true,
    },
    hover: { enabled: true, sticky: true },
    lineDecorationsWidth: 12,
    lineNumbersMinChars: 3,
    lineHeight: 21,
    matchBrackets: 'always',
    minimap: { enabled: true, maxColumn: 80, renderCharacters: false, showSlider: 'mouseover' },
    model: null,
    mouseWheelZoom: true,
    overviewRulerBorder: false,
    padding: { bottom: 14, top: 14 },
    parameterHints: { enabled: true },
    quickSuggestions: { comments: 'off', other: 'on', strings: 'on' },
    readOnly: props.readonly,
    renderLineHighlight: 'line',
    renderLineHighlightOnlyWhenFocus: true,
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    showFoldingControls: 'always',
    smoothScrolling: true,
    stickyScroll: { enabled: true, maxLineCount: 3 },
    suggest: {
      insertMode: 'replace',
      preview: true,
      showClasses: true,
      showFunctions: true,
      showKeywords: true,
      showSnippets: true,
      showWords: true,
    },
    suggestOnTriggerCharacters: true,
    tabSize: 2,
    theme: 'vs-dark',
    wordBasedSuggestions: 'currentDocument',
  })
  codeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => emit('save'))
  cursorSubscription = codeEditor.onDidChangeCursorPosition(({ position }) => {
    cursorColumn.value = position.column
    cursorLine.value = position.lineNumber
  })
  bindModel()
  resizeObserver = new ResizeObserver(() => codeEditor?.layout())
  resizeObserver.observe(container)
})

watch(
  () => [props.filename, props.language] as const,
  () => nextTick(bindModel),
)

watch(
  () => props.modelValue,
  (value) => {
    const model = models.get(props.filename)
    if (model && model.getValue() !== value)
      model.setValue(value)
  },
)

watch(
  () => props.moduleNames,
  (value) => {
    const model = models.get(props.filename)
    if (model)
      modelModuleNames.set(model, value ?? [])
  },
)

watch(
  () => props.readonly,
  value => codeEditor?.updateOptions({ readOnly: value }),
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  changeSubscription?.dispose()
  cursorSubscription?.dispose()
  codeEditor?.dispose()
  models.forEach(model => model.dispose())
  models.clear()
})
</script>

<template>
  <div class="workspace-code-editor-shell">
    <div ref="container" class="workspace-code-editor" />
    <footer class="workspace-code-editor-status" aria-label="Editor status">
      <span>Ln {{ cursorLine }}, Col {{ cursorColumn }}</span>
      <span>Spaces: 2</span>
      <span>UTF-8</span>
      <span>{{ languageLabel }}</span>
    </footer>
  </div>
</template>

<style scoped>
.workspace-code-editor-shell {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) 23px;
  overflow: hidden;
  background: #1e1e1e;
}

.workspace-code-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #1e1e1e;
}

.workspace-code-editor-status {
  display: flex;
  min-width: 0;
  height: 23px;
  padding: 0 9px;
  align-items: center;
  justify-content: flex-end;
  gap: 15px;
  color: #c9d1d9;
  border-top: 1px solid #30363d;
  background: #181d23;
  font-size: 11px;
  line-height: 23px;
  white-space: nowrap;
}
</style>
