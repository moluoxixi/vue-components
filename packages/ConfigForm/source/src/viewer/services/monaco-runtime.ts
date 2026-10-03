import type { editor } from 'monaco-editor'
import type {
  MonacoViewerOptions,
  MonacoViewerRuntime,
  MonacoViewerSession,
} from '../types'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { monacoLanguage } from './language'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'

function modelUri(path: string): monaco.Uri {
  return monaco.Uri.parse(`inmemory://config-form-source/${encodeURIComponent(path)}`)
}

function createModel(options: MonacoViewerOptions): editor.ITextModel {
  return monaco.editor.createModel(
    options.file.content,
    monacoLanguage(options.file.language),
    modelUri(options.file.path),
  )
}

let themesDefined = false

function editorTheme(theme: MonacoViewerOptions['theme']): string {
  if (!themesDefined) {
    monaco.editor.defineTheme('studio-source-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '87929D' },
        { token: 'keyword', foreground: '825BB1' },
        { token: 'tag', foreground: '4778C5' },
        { token: 'attribute.name', foreground: '877642' },
        { token: 'attribute.value', foreground: '17856C' },
        { token: 'attribute.value.html', foreground: '17856C' },
        { token: 'attribute.name.html', foreground: '877642' },
        { token: 'string', foreground: '17856C' },
        { token: 'number', foreground: 'A96543' },
        { token: 'type.identifier', foreground: '327E95' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#283342',
        'editorLineNumber.foreground': '#A0A8B4',
        'editorLineNumber.activeForeground': '#667384',
        'editorIndentGuide.background1': '#E9EDF2',
        'editor.selectionBackground': '#E3EAF8',
      },
    })
    monaco.editor.defineTheme('studio-source-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7D8799' },
        { token: 'keyword', foreground: 'BA9EE9' },
        { token: 'tag', foreground: '78A4EF' },
        { token: 'attribute.name', foreground: 'D9B68B' },
        { token: 'attribute.value', foreground: '8DCEAF' },
        { token: 'attribute.value.html', foreground: '8DCEAF' },
        { token: 'attribute.name.html', foreground: 'D9B68B' },
        { token: 'string', foreground: '8DCEAF' },
        { token: 'number', foreground: 'E9A477' },
        { token: 'type.identifier', foreground: '6AC2D2' },
      ],
      colors: {
        'editor.background': '#1E2127',
        'editor.foreground': '#D4DAE3',
        'editorLineNumber.foreground': '#647084',
        'editorLineNumber.activeForeground': '#B8C2D1',
        'editorIndentGuide.background1': '#303642',
        'editor.selectionBackground': '#34425B',
      },
    })
    themesDefined = true
  }
  return theme === 'light' ? 'studio-source-light' : 'studio-source-dark'
}

function mountMonacoViewer(
  container: HTMLElement,
  initialOptions: MonacoViewerOptions,
): MonacoViewerSession {
  let options = initialOptions
  let model = createModel(options)
  let disposed = false
  const codeEditor = monaco.editor.create(container, {
    ariaLabel: `Read-only source: ${options.file.path}`,
    automaticLayout: false,
    contextmenu: true,
    cursorBlinking: 'solid',
    domReadOnly: true,
    folding: true,
    fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
    fontLigatures: true,
    fontSize: 13,
    glyphMargin: false,
    lineDecorationsWidth: 8,
    lineHeight: 21,
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    model,
    mouseWheelZoom: true,
    overviewRulerBorder: false,
    padding: { bottom: 16, top: 16 },
    readOnly: true,
    renderLineHighlight: 'none',
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    stickyScroll: { enabled: true, maxLineCount: 3 },
    tabSize: 2,
    theme: editorTheme(options.theme),
    wordWrap: options.wrapLines ? 'on' : 'off',
  })

  let resizeObserver: ResizeObserver | undefined
  let removeResizeListener: (() => void) | undefined
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => codeEditor.layout())
    resizeObserver.observe(container)
  }
  else if (typeof window !== 'undefined') {
    const handleResize = (): void => codeEditor.layout()
    window.addEventListener('resize', handleResize)
    removeResizeListener = () => window.removeEventListener('resize', handleResize)
  }

  return {
    dispose(): void {
      if (disposed)
        return
      disposed = true
      resizeObserver?.disconnect()
      removeResizeListener?.()
      codeEditor.setModel(null)
      codeEditor.dispose()
      model.dispose()
    },
    update(nextOptions): void {
      if (disposed)
        return

      const identityChanged = nextOptions.file.path !== options.file.path
        || nextOptions.file.language !== options.file.language
      if (identityChanged) {
        const previousModel = model
        model = createModel(nextOptions)
        codeEditor.setModel(model)
        previousModel.dispose()
      }
      else if (model.getValue() !== nextOptions.file.content) {
        model.setValue(nextOptions.file.content)
      }

      if (nextOptions.theme !== options.theme)
        monaco.editor.setTheme(editorTheme(nextOptions.theme))
      codeEditor.updateOptions({
        ariaLabel: `Read-only source: ${nextOptions.file.path}`,
        domReadOnly: true,
        readOnly: true,
        wordWrap: nextOptions.wrapLines ? 'on' : 'off',
      })
      options = nextOptions
      codeEditor.layout()
    },
  }
}

export function createMonacoViewerRuntime(): MonacoViewerRuntime {
  return { mount: mountMonacoViewer }
}
