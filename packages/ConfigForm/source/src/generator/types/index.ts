import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ContractResult,
  MaterialSemanticTrigger,
  ModelJsonObject,
  ModelJsonValue,
  ProjectId,
  ResourceId,
} from '@moluoxixi/config-form-model'

export type SourceLanguage = 'vue' | 'typescript' | 'json' | 'css' | 'scss' | 'text'

/** Closed style-generation target.  The default remains the existing CSS output. */
export type SourceStyleTarget = 'css' | 'tailwind-v4'

export interface SourceTextFile {
  kind: 'text'
  path: string
  language: SourceLanguage
  content: string
}

export interface SourceBinaryFile {
  kind: 'binary'
  path: string
  mediaType: string
  encoding: 'base64'
  contentBase64: string
}

export type SourceFile = SourceTextFile | SourceBinaryFile
export type SourceFileSetKind = 'raw-source' | 'config-bindings'

interface SourceFileSetBaseV1<TKind extends SourceFileSetKind> {
  version: 1
  kind: TKind
  entry: string
  files: readonly SourceFile[]
}

export type RawSourceFileSetV1 = SourceFileSetBaseV1<'raw-source'>
export type ConfigBindingFileSetV1 = SourceFileSetBaseV1<'config-bindings'>
export type SourceFileSetV1 = RawSourceFileSetV1 | ConfigBindingFileSetV1

export interface SourceAdapterIdentity {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
}

export interface SourceComponentRequest {
  componentKey: string
  contractVersion: string
  contractFingerprint: string
}

export interface SourceLibraryResolution {
  packageName: string
  plugin: string
  version: string
  stylesheet?: string
}

export interface SourceOptionsResolution {
  mode: 'prop' | 'children'
  optionTag?: string
  labelProp?: string
  valueProp?: string
}

export type SourceRenderKind
  = | 'component'
    | 'dataset-list'
    | 'dataset-table'
    | 'layout-flex'
    | 'layout-grid'
    | 'section'

export type SourceSemanticItemResolution
  = | { readonly kind: 'none' }
    | { readonly kind: 'argument', readonly index: number }

/** Provider-owned event projection used only by generated source. */
export interface SourceSemanticListenerResolution {
  /** Raw Vue event name without directives or modifiers. */
  readonly event: string
  /** Public ConfigForm component listener prop for the same event. */
  readonly listenerProp: string
  /** How a row/item semantic trigger obtains its item from event arguments. */
  readonly item: SourceSemanticItemResolution
}

export type SourceSemanticListenerMap = Readonly<Partial<Record<
  MaterialSemanticTrigger,
  SourceSemanticListenerResolution
>>>

export interface SourceComponentResolution {
  /** Empty for native HTML elements. Library plugins are installed once from `library`. */
  moduleSpecifier: string
  /** Empty for native HTML elements. */
  importName: string
  tag: string
  configComponent: string
  render: SourceRenderKind
  styleImports: readonly string[]
  dependencies: Readonly<Record<string, string>>
  library?: SourceLibraryResolution
  options?: SourceOptionsResolution
  staticProps?: ModelJsonObject
  semanticListeners?: SourceSemanticListenerMap
  defaultValue?: ModelJsonValue
  valueProp?: string
  trigger?: string
  blurTrigger?: string
}

export interface SourcePublicImportResolution {
  moduleSpecifier: string
  importName: string
}

export interface SourceConfigFormBindingResolution {
  component: SourcePublicImportResolution
  model: SourcePublicImportResolution
  styleImports: readonly string[]
  dependencies: Readonly<Record<string, string>>
}

export type SourceResolutionResult<T>
  = | { success: true, value: T }
    | { success: false, reason: string }

export interface SourceComponentResolver {
  readonly adapter: SourceAdapterIdentity
  resolveComponent: (
    request: SourceComponentRequest,
  ) => SourceResolutionResult<SourceComponentResolution>
}

export interface SourceConfigFormBindingResolver {
  resolveConfigFormBinding: () => SourceResolutionResult<SourceConfigFormBindingResolution>
}

export interface SourceResourceReader {
  readEmbedded: (request: {
    projectId: ProjectId
    resourceId: ResourceId
    contentHash: string
  }) => Promise<ContractResult<Uint8Array>>
}

interface SourceGenerationInputBase {
  compilation: ProjectCompilation
  componentResolver: SourceComponentResolver
  resourceReader: SourceResourceReader
  /** Optional output target; omitted values are normalized to `css`. */
  styleTarget?: SourceStyleTarget
}

export interface GenerateVueSourceInput extends SourceGenerationInputBase {}

export interface GenerateConfigFormBindingsInput extends SourceGenerationInputBase {
  bindingResolver: SourceConfigFormBindingResolver
}

export type GenerateVueSourceResult = Promise<ContractResult<RawSourceFileSetV1>>
export type GenerateConfigFormBindingsResult = Promise<ContractResult<ConfigBindingFileSetV1>>
