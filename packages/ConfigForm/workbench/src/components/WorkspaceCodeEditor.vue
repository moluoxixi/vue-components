<script setup lang="ts">
import type { editor, IDisposable } from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
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

interface Props {
  filename: string
  language?: string
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
monacoWorkerEnvironment.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    if (label === 'json')
      return new JsonWorker()
    if (label === 'typescript' || label === 'javascript')
      return new TsWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor')
      return new HtmlWorker()
    return new EditorWorker()
  },
}

let languageFeaturesConfigured = false

const WORKBENCH_MODULES = [
  'vue',
  '@moluoxixi/config-form',
  '@moluoxixi/config-form/renderer',
  '@moluoxixi/config-form-headless',
  '@moluoxixi/config-form-designer',
  '@moluoxixi/config-form-element',
  '@moluoxixi/config-form-antd-vue',
  './form.config',
] as const

function completionRange(model: editor.ITextModel, position: monaco.Position): monaco.IRange {
  const word = model.getWordUntilPosition(position)
  return {
    endColumn: word.endColumn,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    startLineNumber: position.lineNumber,
  }
}

function linePrefix(model: editor.ITextModel, position: monaco.Position): string {
  return model.getValueInRange({
    endColumn: position.column,
    endLineNumber: position.lineNumber,
    startColumn: 1,
    startLineNumber: position.lineNumber,
  })
}

function moduleCompletionItems(model: editor.ITextModel, position: monaco.Position): monaco.languages.CompletionItem[] {
  const prefix = linePrefix(model, position)
  const match = prefix.match(/(?:from\s+|import\s*)['"]([^'"]*)$/)
  if (!match)
    return []
  const typed = match[1] ?? ''
  const range = {
    endColumn: position.column,
    endLineNumber: position.lineNumber,
    startColumn: position.column - typed.length,
    startLineNumber: position.lineNumber,
  }
  return WORKBENCH_MODULES.map(moduleName => ({
    detail: 'Workbench module',
    insertText: moduleName,
    kind: monaco.languages.CompletionItemKind.Module,
    label: moduleName,
    range,
  }))
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
        [/(<script)(\s+setup)?(\s+lang=("|')ts\4)?\s*(>)/, [
          { next: '@script', token: 'tag' },
          'attribute.name',
          'attribute.name',
          'attribute.value',
          'attribute.value',
          { nextEmbedded: 'typescript', token: 'tag' },
        ]],
        [/(<style)(\s+scoped)?(\s+lang=("|')(css|scss)\4)?\s*(>)/, [
          { next: '@style', token: 'tag' },
          'attribute.name',
          'attribute.name',
          'attribute.value',
          'attribute.value',
          'attribute.value',
          { nextEmbedded: 'css', token: 'tag' },
        ]],
        [/(<template\s*>)/, { next: '@template', nextEmbedded: 'html', token: 'tag' }],
        [/<!--/, 'comment', '@comment'],
        [/[^<]+/, ''],
        [/<[^>]+>/, 'tag'],
      ],
      script: [
        [/<\/script\s*>/, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      style: [
        [/<\/style\s*>/, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
        [/./, ''],
      ],
      template: [
        [/<\/template\s*>/, { next: '@pop', nextEmbedded: '@pop', token: 'tag' }],
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
  monaco.languages.typescript.typescriptDefaults.addExtraLib(`
declare module '@moluoxixi/config-form-designer' {
  export interface DesignerFormSettings {
    columns?: number
    fieldSpan?: number
    gap?: string
    inline?: boolean
    labelPosition?: 'left' | 'top'
    readonly?: boolean
  }
  export interface DesignerFieldNode {
    id: string
    kind: 'field'
    material: string
    field: string
    label?: string
    span?: number
    defaultValue?: unknown
    props?: Record<string, unknown>
  }
  export interface DesignerContainerNode {
    id: string
    kind: 'container'
    material: string
    slots: Record<string, Array<DesignerFieldNode | DesignerContainerNode>>
  }
  export interface DesignerDocument {
    version: 1
    form: DesignerFormSettings
    nodes: Array<DesignerFieldNode | DesignerContainerNode>
  }
}
declare module 'vue' {
  export function computed<T>(getter: () => T): { readonly value: T }
  export function defineComponent<T>(component: T): T
  export function nextTick(): Promise<void>
  export function onBeforeUnmount(callback: () => void): void
  export function onMounted(callback: () => void): void
  export function reactive<T extends object>(value: T): T
  export function ref<T>(value: T): { value: T }
  export function shallowRef<T>(value?: T): { value: T | undefined }
  export function watch<T>(source: () => T, callback: (value: T, previous: T) => void): void
}
declare module '@moluoxixi/config-form-element' {
  export const ElementConfigForm: unknown
  export type ElementConfigFormField<TValues extends Record<string, unknown> = Record<string, unknown>> = {
    component: string
    field: keyof TValues & string
    label?: string
    props?: Record<string, unknown>
    span?: number
  }
}
declare module '@moluoxixi/config-form-antd-vue' {
  export const AntdConfigForm: unknown
  export type AntdConfigFormField<TValues extends Record<string, unknown> = Record<string, unknown>> = {
    component: string
    field: keyof TValues & string
    label?: string
    props?: Record<string, unknown>
    span?: number
  }
}
declare module '@moluoxixi/config-form/renderer' {
  export const ConfigFormRenderer: unknown
}
declare module '@moluoxixi/config-form-headless' {
  export type ConfigFormValues = Record<string, unknown>
  export interface ConfigFormNodeBase<TValues extends object = ConfigFormValues> {
    component: string
    extensions?: Record<string, unknown>
    props?: Record<string, unknown>
    reactions?: unknown[]
    slots?: Record<string, ConfigFormNode<TValues>[]>
    span?: number
  }
  export interface ConfigFormField<TValues extends object = ConfigFormValues> extends ConfigFormNodeBase<TValues> {
    defaultValue?: unknown
    field: keyof TValues & string
    label?: string
    validateOn?: 'submit' | 'blur' | 'change' | Array<'submit' | 'blur' | 'change'>
  }
  export interface ConfigFormContainer<TValues extends object = ConfigFormValues> extends ConfigFormNodeBase<TValues> {}
  export type ConfigFormNode<TValues extends object = ConfigFormValues> = ConfigFormField<TValues> | ConfigFormContainer<TValues>
  export interface DefineFieldFactory<TValues extends object> {
    (field: ConfigFormField<TValues>): ConfigFormField<TValues>
    (field: ConfigFormContainer<TValues>): ConfigFormContainer<TValues>
  }
  export function defineField<TValues extends object = ConfigFormValues>(field: ConfigFormNode<TValues>): ConfigFormNode<TValues>
  export function defineFields<TValues extends object = ConfigFormValues>(): { defineField: DefineFieldFactory<TValues> }
}
declare module '@moluoxixi/config-form' {
  export { defineField, defineFields } from '@moluoxixi/config-form-headless'
}
declare module './form.config' {
  export const fields: Array<Record<string, unknown>>
  export const form: Record<string, unknown>
  export const initialValues: Record<string, unknown>
}
`, 'inmemory://config-form-workbench/designer.d.ts')
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
      const range = completionRange(model, position)
      return {
        suggestions: [
          ...moduleCompletionItems(model, position),
          {
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
          },
          {
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
          },
        ],
      }
    },
  })

  monaco.languages.registerCompletionItemProvider('vue', {
    triggerCharacters: ['<', '\'', '"', '{', ','],
    provideCompletionItems(model, position) {
      const range = completionRange(model, position)
      const modules = moduleCompletionItems(model, position)
      if (modules.length > 0)
        return { suggestions: modules }
      return {
        suggestions: [
          ...['computed', 'defineComponent', 'nextTick', 'onBeforeUnmount', 'onMounted', 'reactive', 'ref', 'shallowRef', 'watch'].map(name => ({
            detail: 'Vue API',
            insertText: name,
            kind: monaco.languages.CompletionItemKind.Function,
            label: name,
            range,
          })),
          ...['defineField', 'defineFields'].map(name => ({
            detail: 'ConfigForm API',
            insertText: name,
            kind: monaco.languages.CompletionItemKind.Function,
            label: name,
            range,
          })),
          {
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
            range,
          },
          {
            documentation: 'Element Plus ConfigForm component.',
            insertText: '<ElementConfigForm v-model="${1:model}" :fields="${2:fields}" />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Class,
            label: 'ElementConfigForm',
            range,
          },
          {
            documentation: 'Ant Design Vue ConfigForm component.',
            insertText: '<AntdConfigForm v-model="${1:model}" :fields="${2:fields}" />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            kind: monaco.languages.CompletionItemKind.Class,
            label: 'AntdConfigForm',
            range,
          },
        ],
      }
    },
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
    return existing
  }
  const model = monaco.editor.createModel(
    props.modelValue,
    editorLanguage(props.language),
    modelUri(props.filename),
  )
  models.set(props.filename, model)
  return model
}

function bindModel(): void {
  if (!codeEditor)
    return
  changeSubscription?.dispose()
  const model = getModel()
  if (model.getValue() !== props.modelValue)
    model.setValue(props.modelValue)
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
