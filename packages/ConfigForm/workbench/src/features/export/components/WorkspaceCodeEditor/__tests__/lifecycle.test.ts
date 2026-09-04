// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import WorkspaceCodeEditor from '../index.vue'

const mocks = vi.hoisted(() => ({
  addCommand: vi.fn(),
  changeDisposers: [] as ReturnType<typeof vi.fn>[],
  createEditor: vi.fn(),
  createModel: vi.fn(),
  cursorDispose: vi.fn(),
  disconnect: vi.fn(),
  editorDispose: vi.fn(),
  editorLayout: vi.fn(),
  editorSetModel: vi.fn(),
  editorUpdateOptions: vi.fn(),
  models: [] as Array<Record<string, any>>,
  observe: vi.fn(),
  saveCommand: undefined as undefined | (() => void),
  setModelLanguage: vi.fn(),
  setTheme: vi.fn(),
}))
let mountedWrapper: VueWrapper | undefined

vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({ default: class EditorWorker {} }))
vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({ default: class HtmlWorker {} }))
vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({ default: class JsonWorker {} }))
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({ default: class TypeScriptWorker {} }))

vi.mock('monaco-editor/esm/vs/basic-languages/css/css.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/html/html.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/codeAction/browser/codeActionContributions', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/find/browser/findController', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/folding/browser/folding', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/format/browser/formatActions', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/links/browser/links', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController', () => ({}))
vi.mock('monaco-editor/esm/vs/language/html/monaco.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/language/json/monaco.contribution', () => ({}))
vi.mock('monaco-editor/esm/vs/language/typescript/monaco.contribution', () => ({}))

vi.mock('monaco-editor/esm/vs/editor/editor.api', () => {
  const disposable = () => ({ dispose: vi.fn() })
  const typeScriptDefaults = {
    addExtraLib: vi.fn(),
    setCompilerOptions: vi.fn(),
    setEagerModelSync: vi.fn(),
  }
  return {
    editor: {
      create: mocks.createEditor,
      createModel: mocks.createModel,
      getModel: vi.fn(),
      setModelLanguage: mocks.setModelLanguage,
      setTheme: mocks.setTheme,
    },
    KeyCode: { KeyS: 49 },
    KeyMod: { CtrlCmd: 2048 },
    languages: {
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      CompletionItemKind: {
        Class: 7,
        Enum: 15,
        Field: 5,
        Function: 1,
        Interface: 8,
        Keyword: 17,
        Module: 9,
        Property: 9,
        Snippet: 27,
        Variable: 4,
      },
      CompletionItemTag: { Deprecated: 1 },
      html: {
        htmlDefaults: { setOptions: vi.fn() },
        registerHTMLLanguageService: vi.fn(),
      },
      register: vi.fn(),
      registerCompletionItemProvider: vi.fn(disposable),
      registerHoverProvider: vi.fn(disposable),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      typescript: {
        getTypeScriptWorker: vi.fn(() => Promise.resolve(async () => ({}))),
        ModuleKind: { ESNext: 99 },
        ModuleResolutionKind: { NodeJs: 2 },
        ScriptTarget: { Latest: 99 },
        typescriptDefaults: typeScriptDefaults,
      },
    },
    Range: class Range {
      constructor(..._args: number[]) {}
    },
    Uri: {
      parse: (value: string) => ({ toString: () => value }),
    },
  }
})

function createModel(value: string, language: string, uri: { toString: () => string }) {
  let currentValue = value
  let currentLanguage = language
  let disposed = false
  const contentListeners = new Set<() => void>()
  const disposeListeners = new Set<() => void>()
  const model = {
    dispose: vi.fn(() => {
      disposed = true
      disposeListeners.forEach(listener => listener())
    }),
    getLanguageId: () => currentLanguage,
    getValue: () => currentValue,
    isDisposed: () => disposed,
    onDidChangeContent: vi.fn((listener: () => void) => {
      contentListeners.add(listener)
      const dispose = vi.fn(() => contentListeners.delete(listener))
      mocks.changeDisposers.push(dispose)
      return { dispose }
    }),
    onWillDispose: vi.fn((listener: () => void) => {
      disposeListeners.add(listener)
      return { dispose: vi.fn(() => disposeListeners.delete(listener)) }
    }),
    setLanguage: (next: string) => currentLanguage = next,
    setValue: vi.fn((next: string) => {
      currentValue = next
      contentListeners.forEach(listener => listener())
    }),
    uri,
  }
  mocks.models.push(model)
  return model
}

describe('workspace code editor lifecycle', () => {
  beforeEach(() => {
    mocks.changeDisposers.length = 0
    mocks.models.length = 0
    mocks.saveCommand = undefined
    mocks.createModel.mockImplementation(createModel)
    mocks.setModelLanguage.mockImplementation((model, language) => model.setLanguage(language))
    mocks.addCommand.mockImplementation((_key, command) => {
      mocks.saveCommand = command
    })
    mocks.createEditor.mockReturnValue({
      addCommand: mocks.addCommand,
      dispose: mocks.editorDispose,
      layout: mocks.editorLayout,
      onDidChangeCursorPosition: () => ({ dispose: mocks.cursorDispose }),
      setModel: mocks.editorSetModel,
      updateOptions: mocks.editorUpdateOptions,
    })
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      disconnect = mocks.disconnect
      observe = mocks.observe
    })
  })

  afterEach(() => {
    mountedWrapper?.unmount()
    mountedWrapper = undefined
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('reuses filename models, updates options, emits save, and disposes every owner', async () => {
    const wrapper = mount(WorkspaceCodeEditor, {
      props: {
        filename: 'src/App.vue',
        language: 'plaintext',
        modelValue: 'first',
      },
    })
    mountedWrapper = wrapper
    const firstModel = mocks.models[0]!
    expect(mocks.createModel).toHaveBeenCalledOnce()
    expect(mocks.editorSetModel).toHaveBeenLastCalledWith(firstModel)
    expect(mocks.observe).toHaveBeenCalledOnce()

    mocks.saveCommand?.()
    expect(wrapper.emitted('save')).toEqual([[]])

    await wrapper.setProps({ readonly: true, theme: 'light' })
    expect(mocks.editorUpdateOptions).toHaveBeenCalledWith({ readOnly: true })
    expect(mocks.setTheme).toHaveBeenCalledWith('vs')

    await wrapper.setProps({ filename: 'project.config.ts', language: 'json', modelValue: 'second' })
    await nextTick()
    const secondModel = mocks.models[1]!
    expect(mocks.createModel).toHaveBeenCalledTimes(2)
    expect(mocks.changeDisposers[0]).toHaveBeenCalledOnce()
    expect(mocks.editorSetModel).toHaveBeenLastCalledWith(secondModel)

    await wrapper.setProps({ filename: 'src/App.vue', language: 'plaintext', modelValue: 'first updated' })
    await nextTick()
    expect(mocks.createModel).toHaveBeenCalledTimes(2)
    expect(mocks.editorSetModel).toHaveBeenLastCalledWith(firstModel)
    expect(firstModel.setValue).toHaveBeenCalledWith('first updated')

    firstModel.setValue('edited')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['edited'])

    wrapper.unmount()
    mountedWrapper = undefined
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    expect(mocks.changeDisposers.at(-1)).toHaveBeenCalledOnce()
    expect(mocks.cursorDispose).toHaveBeenCalledOnce()
    expect(mocks.editorDispose).toHaveBeenCalledOnce()
    expect(firstModel.dispose).toHaveBeenCalledOnce()
    expect(secondModel.dispose).toHaveBeenCalledOnce()
  })

  it('disposes the Vue TypeScript mirror with its source model', () => {
    const wrapper = mount(WorkspaceCodeEditor, {
      props: {
        filename: 'src/App.vue',
        language: 'vue',
        modelValue: '<script setup lang="ts">\nconst value = 1\n</script>\n',
      },
    })
    mountedWrapper = wrapper
    const sourceModel = mocks.models[0]!
    const mirrorModel = mocks.models[1]!

    expect(mocks.models).toHaveLength(2)
    expect(mirrorModel.getLanguageId()).toBe('typescript')
    expect(mirrorModel.uri.toString()).toBe('inmemory://config-form-workbench/src/App.vue.ts')

    wrapper.unmount()
    mountedWrapper = undefined
    expect(sourceModel.dispose).toHaveBeenCalledOnce()
    expect(mirrorModel.dispose).toHaveBeenCalledOnce()
    expect(mocks.changeDisposers).toHaveLength(2)
    mocks.changeDisposers.forEach(dispose => expect(dispose).toHaveBeenCalledOnce())
  })
})
