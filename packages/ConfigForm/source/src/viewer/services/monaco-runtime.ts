import type { editor } from 'monaco-editor'
import type {
  MonacoViewerOptions,
  MonacoViewerRuntime,
  MonacoViewerSession,
} from '../types'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'
import { monacoLanguage } from './language'

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

function editorTheme(theme: MonacoViewerOptions['theme']): 'vs' | 'vs-dark' {
  return theme === 'light' ? 'vs' : 'vs-dark'
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
    wordWrap: 'off',
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
      })
      options = nextOptions
      codeEditor.layout()
    },
  }
}

export function createMonacoViewerRuntime(): MonacoViewerRuntime {
  return { mount: mountMonacoViewer }
}
