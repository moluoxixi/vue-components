import type { ElementPlusDocsReplStore } from '../src/repl/types'
import { File } from '@vue/repl/core'
import { describe, expect, it, vi } from 'vitest'
import {
  createElementPlusDocsReplImportMap,
} from '../src/repl/dependency'
import {
  decodeElementPlusDocsReplState,
  encodeElementPlusDocsReplState,
  initializeElementPlusDocsReplStore,
} from '../src/repl/store'
import {
  elementPlusDocsReplMainSource,
  elementPlusDocsReplSetupSource,
} from '../src/repl/templates'

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
})
