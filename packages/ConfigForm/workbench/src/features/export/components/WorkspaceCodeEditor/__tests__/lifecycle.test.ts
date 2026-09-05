// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import WorkspaceCodeEditor from '../index.vue'
import {
  configureLanguageFeatures,
  disposeMonacoLanguageFeatures,
  installMonacoWorkerEnvironment,
  warmTypeScriptWorker,
} from '../services'

const mocks = vi.hoisted(() => ({
  addCommand: vi.fn(),
  changeDisposers: [] as ReturnType<typeof vi.fn>[],
  completionProviders: [] as Array<{ language: string, provider: Record<string, any> }>,
  createEditor: vi.fn(),
  createModel: vi.fn(),
  cursorDispose: vi.fn(),
  disconnect: vi.fn(),
  disposalOrder: [] as number[],
  editorDispose: vi.fn(),
  editorLayout: vi.fn(),
  editorSetModel: vi.fn(),
  editorUpdateOptions: vi.fn(),
  getTypeScriptWorker: vi.fn(),
  hoverProviders: [] as Array<{ language: string, provider: Record<string, any> }>,
  languageDisposers: [] as ReturnType<typeof vi.fn>[],
  models: [] as Array<Record<string, any>>,
  observe: vi.fn(),
  saveCommand: undefined as undefined | (() => void),
  setModelLanguage: vi.fn(),
  setupTypeScript: vi.fn(),
  setTheme: vi.fn(),
  typeScriptWorker: {
    getCompletionEntryDetails: vi.fn(),
    getCompletionsAtPosition: vi.fn(),
    getQuickInfoAtPosition: vi.fn(),
  },
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
vi.mock('monaco-editor/esm/vs/language/typescript/tsMode', () => ({ setupTypeScript: mocks.setupTypeScript }))

vi.mock('monaco-editor/esm/vs/editor/editor.api', () => {
  const disposable = () => {
    const index = mocks.languageDisposers.length
    const dispose = vi.fn(() => mocks.disposalOrder.push(index))
    mocks.languageDisposers.push(dispose)
    return { dispose }
  }
  const typeScriptDefaults = {
    addExtraLib: vi.fn(disposable),
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
      registerCompletionItemProvider: vi.fn((language: string, provider: Record<string, any>) => {
        mocks.completionProviders.push({ language, provider })
        return disposable()
      }),
      registerHoverProvider: vi.fn((language: string, provider: Record<string, any>) => {
        mocks.hoverProviders.push({ language, provider })
        return disposable()
      }),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      typescript: {
        getTypeScriptWorker: mocks.getTypeScriptWorker,
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
    getOffsetAt: ({ column, lineNumber }: { column: number, lineNumber: number }) => {
      const lines = currentValue.split('\n')
      return lines.slice(0, lineNumber - 1).reduce((total, line) => total + line.length + 1, 0) + column - 1
    },
    getPositionAt: (offset: number) => {
      const lines = currentValue.slice(0, offset).split('\n')
      return { column: lines.at(-1)!.length + 1, lineNumber: lines.length }
    },
    getValue: () => currentValue,
    getWordUntilPosition: ({ column, lineNumber }: { column: number, lineNumber: number }) => {
      const prefix = currentValue.split('\n')[lineNumber - 1]!.slice(0, column - 1)
      const word = prefix.match(/[\w$]+$/)?.[0] ?? ''
      return { endColumn: column, startColumn: column - word.length, word }
    },
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
    mocks.completionProviders.length = 0
    mocks.disposalOrder.length = 0
    mocks.hoverProviders.length = 0
    mocks.languageDisposers.length = 0
    mocks.models.length = 0
    mocks.saveCommand = undefined
    mocks.createModel.mockImplementation(createModel)
    mocks.getTypeScriptWorker.mockReset()
    mocks.getTypeScriptWorker.mockResolvedValue(async () => mocks.typeScriptWorker)
    mocks.setupTypeScript.mockReset()
    mocks.typeScriptWorker.getCompletionEntryDetails.mockReset()
    mocks.typeScriptWorker.getCompletionEntryDetails.mockResolvedValue({
      displayParts: [{ text: 'const alpha: number' }],
      documentation: [{ text: 'Alpha value.' }],
      kind: 'const',
      name: 'alpha',
    })
    mocks.typeScriptWorker.getCompletionsAtPosition.mockReset()
    mocks.typeScriptWorker.getCompletionsAtPosition.mockResolvedValue({
      entries: [{ kind: 'const', name: 'alpha', sortText: '11' }],
    })
    mocks.typeScriptWorker.getQuickInfoAtPosition.mockReset()
    mocks.typeScriptWorker.getQuickInfoAtPosition.mockResolvedValue({
      displayParts: [{ text: 'const alpha: number' }],
      documentation: [{ text: 'Alpha value.' }],
      textSpan: { length: 5, start: 31 },
    })
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
    disposeMonacoLanguageFeatures()
    delete (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('installs the worker environment when no previous environment exists', () => {
    const environment = globalThis as typeof globalThis & {
      MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker }
    }
    delete environment.MonacoEnvironment

    installMonacoWorkerEnvironment()

    const installed = (globalThis as typeof globalThis & {
      MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker }
    }).MonacoEnvironment
    expect(installed?.getWorker('module', 'vue')).toBeDefined()
  })

  it('reuses filename models, updates options, emits save, and disposes every owner', async () => {
    const previousWorker = {} as Worker
    const previousGetWorker = vi.fn(() => previousWorker)
    ;(globalThis as typeof globalThis & {
      MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker }
    }).MonacoEnvironment = { getWorker: previousGetWorker }
    const wrapper = mount(WorkspaceCodeEditor, {
      props: {
        filename: 'src/App.vue',
        language: 'plaintext',
        modelValue: 'first',
      },
    })
    mountedWrapper = wrapper
    const firstModel = mocks.models[0]!
    const workerEnvironment = (globalThis as typeof globalThis & {
      MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker }
    }).MonacoEnvironment
    expect(workerEnvironment.getWorker('module', 'css')).toBe(previousWorker)
    expect(previousGetWorker).toHaveBeenCalledWith('module', 'css')
    expect(workerEnvironment.getWorker('module', 'vue')).not.toBe(previousWorker)
    const replacementWorker = {} as Worker
    const replacementGetWorker = vi.fn(() => replacementWorker)
    ;(globalThis as typeof globalThis & {
      MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker }
    }).MonacoEnvironment = { getWorker: replacementGetWorker }
    installMonacoWorkerEnvironment()
    const replacedEnvironment = (globalThis as typeof globalThis & {
      MonacoEnvironment: { getWorker: (moduleId: string, label: string) => Worker }
    }).MonacoEnvironment
    expect(replacedEnvironment.getWorker('module', 'css')).toBe(replacementWorker)
    expect(replacementGetWorker).toHaveBeenCalledWith('module', 'css')
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
    expect(mocks.languageDisposers).toHaveLength(5)
    disposeMonacoLanguageFeatures()
    mocks.languageDisposers.forEach(dispose => expect(dispose).toHaveBeenCalledOnce())
    expect(mocks.disposalOrder).toEqual([4, 3, 2, 1, 0])
  })

  it('reconfigures providers after global disposal', () => {
    configureLanguageFeatures()
    expect(mocks.languageDisposers).toHaveLength(5)

    disposeMonacoLanguageFeatures()
    configureLanguageFeatures()

    expect(mocks.languageDisposers).toHaveLength(10)
    mocks.languageDisposers.slice(0, 5).forEach(dispose => expect(dispose).toHaveBeenCalledOnce())
    mocks.languageDisposers.slice(5).forEach(dispose => expect(dispose).not.toHaveBeenCalled())
  })

  it('initializes the TypeScript mode after a missed one-shot language event', async () => {
    const model = createModel('const value = 1', 'typescript', { toString: () => 'inmemory://worker.ts' })
    mocks.getTypeScriptWorker.mockReset()
    mocks.getTypeScriptWorker
      .mockRejectedValueOnce('TypeScript not registered!')
      .mockResolvedValueOnce(async () => mocks.typeScriptWorker)

    await warmTypeScriptWorker(model as never)

    expect(mocks.setupTypeScript).toHaveBeenCalledOnce()
    expect(mocks.getTypeScriptWorker).toHaveBeenCalledTimes(2)
  })

  it('serves Vue script completion details and hover through the TypeScript mirror', async () => {
    configureLanguageFeatures()
    const source = '<script setup lang="ts">\nconst alpha = 1\n</script>\n'
    const model = createModel(source, 'vue', { toString: () => 'inmemory://source.vue' })
    const position = model.getPositionAt(source.indexOf('alpha') + 5)
    const token = { isCancellationRequested: false }
    const completionProvider = mocks.completionProviders.find(item => item.language === 'vue')!.provider
    const hoverProvider = mocks.hoverProviders.find(item => item.language === 'vue')!.provider

    const completion = await completionProvider.provideCompletionItems(model, position, {}, token)
    expect(completion.suggestions[0]).toMatchObject({ label: 'alpha' })
    await expect(completionProvider.resolveCompletionItem(completion.suggestions[0], token)).resolves.toMatchObject({
      detail: 'const alpha: number',
      documentation: { value: 'Alpha value.' },
    })
    await expect(hoverProvider.provideHover(model, position, token)).resolves.toMatchObject({
      contents: [
        { value: '```typescript\nconst alpha: number\n```' },
        { value: 'Alpha value.' },
      ],
    })

    model.dispose()
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

    sourceModel.setValue('<script setup lang="ts">\nconst next = 2\n</script>\n')
    expect(mirrorModel.setValue).toHaveBeenLastCalledWith(expect.stringContaining('const next = 2'))

    wrapper.unmount()
    mountedWrapper = undefined
    expect(sourceModel.dispose).toHaveBeenCalledOnce()
    expect(mirrorModel.dispose).toHaveBeenCalledOnce()
    expect(mocks.changeDisposers).toHaveLength(2)
    mocks.changeDisposers.forEach(dispose => expect(dispose).toHaveBeenCalledOnce())
  })
})
