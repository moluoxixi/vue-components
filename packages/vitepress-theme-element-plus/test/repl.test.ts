import type { ElementPlusDocsReplStore } from '../src/repl/types'
import { File } from '@vue/repl/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createElementPlusDocsReplImportMap,
} from '../src/repl/dependency'
import {
  createElementPlusDocsReplStore,
  decodeElementPlusDocsReplState,
  encodeElementPlusDocsReplState,
  initializeElementPlusDocsReplStore,
} from '../src/repl/store'
import {
  elementPlusDocsReplMainSource,
  elementPlusDocsReplSetupSource,
} from '../src/repl/templates'

vi.mock('../src/repl/dependency', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/repl/dependency')>()
  return {
    ...actual,
    createElementPlusDocsCompilerUrl: () => 'data:text/javascript,export {}',
  }
})

describe('self-hosted Vue REPL', () => {
  it('round-trips the official file-state protocol with Unicode source', () => {
    const state = {
      'App.vue': '<template>你好，Playground</template>',
      '_o': { vueVersion: '3.5.33' },
    }
    const encoded = encodeElementPlusDocsReplState(state)

    expect(encoded).not.toContain('Playground')
    expect(decodeElementPlusDocsReplState(encoded)).toEqual(state)
    expect(decodeElementPlusDocsReplState('not-base64')).toBeUndefined()
  })

  it('maps the consumer component package to its same-origin browser bundle', () => {
    const moduleUrl = 'https://example.test/vue-playground/runtime/components.js'
    const importMap = createElementPlusDocsReplImportMap({
      cdn: 'jsdelivr',
      componentPackage: {
        moduleUrl,
        name: '@example/components',
      },
      elementPlusVersion: '2.9.1',
      vueVersion: '3.5.33',
    })

    expect(importMap.imports?.['@example/components']).toBe(moduleUrl)
    expect(importMap.imports?.vue).toContain('@vue/runtime-dom@3.5.33')
    expect(importMap.imports?.['element-plus']).toContain('element-plus@2.9.1')
  })

  it('keeps the official wrapper entry and current Element Plus installer contract', () => {
    expect(elementPlusDocsReplMainSource).toContain('import App from \'./App.vue\'')
    expect(elementPlusDocsReplMainSource).toContain('import { setupElementPlus } from \'./element-plus.js\'')
    expect(elementPlusDocsReplSetupSource).toContain('import { install as installElementPlus } from \'element-plus\'')
    expect(elementPlusDocsReplSetupSource).toContain('app.use({ install: installElementPlus })')
    expect(elementPlusDocsReplSetupSource).not.toContain('elementPlusExports')
  })

  it('compiles the active file and hidden wrapper during initialization', () => {
    const activeFile = new File('src/App.vue', '<template>App</template>')
    const mainFile = new File('src/PlaygroundMain.vue', '<template>Main</template>', true)
    const setupFile = new File('src/element-plus.js', 'export {}', true)
    const compile = vi.fn(async () => [])
    const store = {
      activeFile,
      activeFilename: activeFile.filename,
      errors: [],
      files: {
        [activeFile.filename]: activeFile,
        [mainFile.filename]: mainFile,
        [setupFile.filename]: setupFile,
      },
    } as unknown as ElementPlusDocsReplStore

    initializeElementPlusDocsReplStore(store, compile)

    expect(compile.mock.calls.map(([, file]) => file.filename)).toEqual([
      'src/App.vue',
      'src/PlaygroundMain.vue',
      'src/element-plus.js',
    ])
  })

  it('keeps the wrapper as the preview entry when loading a shared demo state', async () => {
    const initialized = vi.fn()
    const starterSource = '<template><p>Starter</p></template>'
    const source = '<template><p>CopyText demo</p></template>'
    const store = createElementPlusDocsReplStore({
      componentPackage: {
        moduleUrl: 'https://example.test/components.js',
        name: '@example/components',
      },
      initialized,
      serializedState: encodeElementPlusDocsReplState({ 'App.vue': source }),
      starterSource,
      vueVersion: '3.5.33',
    })

    await vi.waitFor(() => expect(initialized).toHaveBeenCalledOnce())

    expect(store.mainFile).toBe('src/PlaygroundMain.vue')
    expect(store.files['src/App.vue']?.code).toBe(source)
    expect(store.files['src/PlaygroundMain.vue']?.code).toBe(elementPlusDocsReplMainSource)
    expect(store.files['src/PlaygroundMain.vue']?.code).not.toBe(starterSource)
  })
})
