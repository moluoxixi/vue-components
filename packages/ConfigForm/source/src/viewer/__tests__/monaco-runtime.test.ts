// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMonacoViewerRuntime } from '../services/monaco-runtime'

const monacoMocks = vi.hoisted(() => {
  const editors: Array<Record<string, ReturnType<typeof vi.fn>>> = []
  const models: Array<{
    dispose: ReturnType<typeof vi.fn>
    getValue: ReturnType<typeof vi.fn>
    setValue: ReturnType<typeof vi.fn>
    value: string
  }> = []
  const createModel = vi.fn((value: string) => {
    const model = {
      dispose: vi.fn(),
      getValue: vi.fn(() => model.value),
      setValue: vi.fn((next: string) => model.value = next),
      value,
    }
    models.push(model)
    return model
  })
  const create = vi.fn(() => {
    const editor = {
      dispose: vi.fn(),
      layout: vi.fn(),
      setModel: vi.fn(),
      updateOptions: vi.fn(),
    }
    editors.push(editor)
    return editor
  })
  return { create, createModel, editors, models, setTheme: vi.fn() }
})

vi.mock('monaco-editor/esm/vs/editor/editor.api', () => ({
  editor: {
    create: monacoMocks.create,
    createModel: monacoMocks.createModel,
    setTheme: monacoMocks.setTheme,
  },
  Uri: { parse: (value: string) => value },
}))
vi.mock('monaco-editor/esm/vs/basic-languages/css/css.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/html/html.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/scss/scss.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution', () => ({}))

describe('monaco viewer runtime', () => {
  const disconnect = vi.fn()
  const observe = vi.fn()

  beforeEach(() => {
    monacoMocks.editors.length = 0
    monacoMocks.models.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      disconnect = disconnect
      observe = observe
    })
  })

  it('updates models and releases the observer, editor, and every model', () => {
    const session = createMonacoViewerRuntime().mount(document.createElement('div'), {
      file: { content: 'first', kind: 'text', language: 'typescript', path: 'src/main.ts' },
      theme: 'dark',
    })
    const editor = monacoMocks.editors[0]!
    const firstModel = monacoMocks.models[0]!

    session.update({
      file: { content: 'updated', kind: 'text', language: 'typescript', path: 'src/main.ts' },
      theme: 'light',
    })
    expect(firstModel.setValue).toHaveBeenCalledWith('updated')
    expect(monacoMocks.setTheme).toHaveBeenCalledWith('vs')

    session.update({
      file: { content: '<template />', kind: 'text', language: 'vue', path: 'src/App.vue' },
      theme: 'light',
    })
    const secondModel = monacoMocks.models[1]!
    expect(editor.setModel).toHaveBeenCalledWith(secondModel)
    expect(firstModel.dispose).toHaveBeenCalledOnce()

    session.dispose()
    session.dispose()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(editor.setModel).toHaveBeenLastCalledWith(null)
    expect(editor.dispose).toHaveBeenCalledOnce()
    expect(secondModel.dispose).toHaveBeenCalledOnce()
  })
})
