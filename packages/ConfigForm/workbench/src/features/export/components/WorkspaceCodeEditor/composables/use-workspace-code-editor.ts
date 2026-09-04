import type { editor, IDisposable } from 'monaco-editor'
import type { WorkspaceCodeEditorProps } from '../types'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import {
  configureLanguageFeatures,
  installMonacoWorkerEnvironment,
  setModelModuleNames,
  warmTypeScriptWorker,
  warmVueTypeScriptWorker,
} from '../services'

interface WorkspaceCodeEditorEmit {
  (event: 'save'): void
  (event: 'update:modelValue', value: string): void
}

type ResolvedWorkspaceCodeEditorProps = Readonly<WorkspaceCodeEditorProps & {
  language: string
  readonly: boolean
  theme: 'dark' | 'light'
}>

export function useWorkspaceCodeEditor(
  props: ResolvedWorkspaceCodeEditorProps,
  emit: WorkspaceCodeEditorEmit,
) {
  const containerRef = useTemplateRef<HTMLElement>('container')
  const models = new Map<string, editor.ITextModel>()
  const cursorLine = ref(1)
  const cursorColumn = ref(1)
  const locale = computed(() => createDesignerLocale(props.locale))
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

  installMonacoWorkerEnvironment()

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
      setModelModuleNames(existing, props.moduleNames ?? [])
      return existing
    }
    const model = monaco.editor.createModel(
      props.modelValue,
      editorLanguage(props.language),
      modelUri(props.filename),
    )
    models.set(props.filename, model)
    setModelModuleNames(model, props.moduleNames ?? [])
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
      theme: props.theme === 'dark' ? 'vs-dark' : 'vs',
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
        setModelModuleNames(model, value ?? [])
    },
  )

  watch(
    () => props.readonly,
    value => codeEditor?.updateOptions({ readOnly: value }),
  )

  watch(
    () => props.theme,
    value => monaco.editor.setTheme(value === 'dark' ? 'vs-dark' : 'vs'),
  )

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    changeSubscription?.dispose()
    cursorSubscription?.dispose()
    codeEditor?.dispose()
    models.forEach(model => model.dispose())
    models.clear()
  })

  return { containerRef, cursorColumn, cursorLine, languageLabel, locale }
}
