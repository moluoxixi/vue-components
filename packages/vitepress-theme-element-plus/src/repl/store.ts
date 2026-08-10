import type { ImportMap, StoreState } from '@vue/repl/core'
import type {
  ElementPlusDocsReplSerializedState,
  ElementPlusDocsReplStore,
  ElementPlusDocsReplStoreOptions,
  ElementPlusDocsReplVersionKey,
} from './types'
import {
  compileFile,
  File,
  useStore as useVueReplStore,
} from '@vue/repl/core'
import { computed, reactive, toRefs, watch, watchEffect } from 'vue'
import {
  createElementPlusDocsCompilerUrl,
  createElementPlusDocsReplImportMap,
} from './dependency'
import {
  createElementPlusDocsReplDeclarations,
  elementPlusDocsReplAppFile,
  elementPlusDocsReplDeclarationsFile,
  elementPlusDocsReplImportMapFile,
  elementPlusDocsReplMainFile,
  elementPlusDocsReplMainSource,
  elementPlusDocsReplSetupFile,
  elementPlusDocsReplSetupSource,
  elementPlusDocsReplTsconfigFile,
  elementPlusDocsReplTsconfigSource,
} from './templates'

const defaultVueVersion = '3.5.33'
const defaultElementPlusVersion = '2.9.1'
const defaultTypescriptVersion = '5.9.2'

function decodeUtf8Base64(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeElementPlusDocsReplState(
  serializedState: string | undefined,
): ElementPlusDocsReplSerializedState | undefined {
  if (!serializedState)
    return undefined
  try {
    const parsed = JSON.parse(decodeUtf8Base64(serializedState)) as unknown
    return parsed && typeof parsed === 'object'
      ? parsed as ElementPlusDocsReplSerializedState
      : undefined
  }
  catch {
    return undefined
  }
}

export function encodeElementPlusDocsReplState(
  state: ElementPlusDocsReplSerializedState,
): string {
  return encodeUtf8Base64(JSON.stringify(state))
}

function normalizeFilename(filename: string): string {
  if ([elementPlusDocsReplImportMapFile, elementPlusDocsReplTsconfigFile].includes(filename))
    return filename
  return filename.startsWith('src/') ? filename : `src/${filename}`
}

function createFiles(
  saved: ElementPlusDocsReplSerializedState | undefined,
  options: ElementPlusDocsReplStoreOptions,
): Record<string, File> {
  const files: Record<string, File> = Object.create(null) as Record<string, File>
  if (saved) {
    for (const [rawFilename, source] of Object.entries(saved)) {
      if (rawFilename === '_o' || typeof source !== 'string')
        continue
      const filename = normalizeFilename(rawFilename)
      files[filename] = new File(filename, source)
    }
  }

  files[elementPlusDocsReplAppFile] ??= new File(
    elementPlusDocsReplAppFile,
    options.starterSource,
  )
  files[elementPlusDocsReplMainFile] ??= new File(
    elementPlusDocsReplMainFile,
    elementPlusDocsReplMainSource,
    true,
  )
  files[elementPlusDocsReplSetupFile] ??= new File(
    elementPlusDocsReplSetupFile,
    elementPlusDocsReplSetupSource,
    true,
  )
  files[elementPlusDocsReplDeclarationsFile] ??= new File(
    elementPlusDocsReplDeclarationsFile,
    options.componentPackage.declarations
    ?? createElementPlusDocsReplDeclarations(options.componentPackage.name),
    true,
  )
  files[elementPlusDocsReplTsconfigFile] ??= new File(
    elementPlusDocsReplTsconfigFile,
    elementPlusDocsReplTsconfigSource,
  )
  return files
}

export function initializeElementPlusDocsReplStore(
  store: ElementPlusDocsReplStore,
  compile: typeof compileFile = compileFile,
): void {
  watchEffect(() => {
    void compile(store, store.activeFile).then((errors) => {
      store.errors = errors
    })
  })

  for (const [filename, file] of Object.entries(store.files)) {
    if (filename === store.activeFilename)
      continue
    void compile(store, file).then((errors) => {
      store.errors.push(...errors)
    })
  }
}

export function createElementPlusDocsReplStore(
  options: ElementPlusDocsReplStoreOptions,
): ElementPlusDocsReplStore {
  const cdn = options.cdn ?? 'jsdelivr'
  const saved = decodeElementPlusDocsReplState(options.serializedState)
  const savedOptions = saved?._o
  const versions = reactive<Record<ElementPlusDocsReplVersionKey, string>>({
    elementPlus: savedOptions?.elementPlusVersion ?? options.elementPlusVersion ?? defaultElementPlusVersion,
    typescript: savedOptions?.typescriptVersion ?? options.typescriptVersion ?? defaultTypescriptVersion,
    vue: savedOptions?.vueVersion ?? options.vueVersion ?? defaultVueVersion,
  })
  const builtinImportMap = computed<ImportMap>(() => createElementPlusDocsReplImportMap({
    cdn,
    componentPackage: options.componentPackage,
    elementPlusVersion: versions.elementPlus,
    vueVersion: versions.vue,
  }))
  const state = toRefs(reactive({
    activeFilename: elementPlusDocsReplAppFile,
    builtinImportMap,
    files: createFiles(saved, options),
    mainFile: elementPlusDocsReplMainFile,
    sfcOptions: {
      script: { propsDestructure: true },
    },
    template: { welcomeSFC: options.starterSource },
    typescriptVersion: versions.typescript,
    vueVersion: versions.vue,
  })) as Partial<StoreState>
  const store = useVueReplStore(state) as ElementPlusDocsReplStore

  store.componentPackage = options.componentPackage
  store.versions = versions
  store.serialize = () => encodeElementPlusDocsReplState({
    ...store.getFiles(),
    _o: {
      elementPlusVersion: versions.elementPlus,
      typescriptVersion: versions.typescript,
      vueVersion: versions.vue,
    },
  })
  store.resetFiles = () => {
    for (const filename of Object.keys(store.files)) {
      if (![elementPlusDocsReplMainFile, elementPlusDocsReplSetupFile, elementPlusDocsReplDeclarationsFile, elementPlusDocsReplImportMapFile, elementPlusDocsReplTsconfigFile].includes(filename))
        delete store.files[filename]
    }
    store.addFile(new File(elementPlusDocsReplAppFile, options.starterSource))
    store.setActive(elementPlusDocsReplAppFile)
  }
  store.setVersion = async (key, version) => {
    if (key === 'vue') {
      store.compiler = await import(
        /* @vite-ignore */ createElementPlusDocsCompilerUrl(cdn, version),
      )
      store.vueVersion = version
      versions.vue = version
      return
    }
    if (key === 'typescript') {
      store.typescriptVersion = version
      versions.typescript = version
      store.reloadLanguageTools?.()
      return
    }
    versions.elementPlus = version
  }

  // The official Element Plus playground owns this initialization boundary.
  // @vue/repl's default init intentionally skips `mainFile`, because its
  // stock main file is compiled by the host. Our wrapper is the actual entry
  // rendered by the preview, so it must be compiled along with the rest of
  // the in-memory project before the sandbox is created.
  store.init = () => {
    initializeElementPlusDocsReplStore(store)
  }

  watch(builtinImportMap, (importMap) => {
    store.setImportMap(importMap)
  }, { deep: true })

  void store.setVersion('vue', versions.vue).then(options.initialized)
  return store
}
