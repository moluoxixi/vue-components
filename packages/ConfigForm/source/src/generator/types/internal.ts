import type { ModelJsonObject, ProjectTheme } from '@moluoxixi/config-form-model'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import type {
  SourceBinaryFile,
  SourceComponentResolution,
  SourceStyleTarget,
} from './index'

export interface EmitStyleContext {
  node: {
    kind: string
    props: Readonly<Record<string, unknown>>
  }
}

export interface SourceStyleBackend {
  readonly target: SourceStyleTarget
  readonly rawStyleFile: string
  readonly bindingStyleFile: string
  readonly packageDevDependencies: Readonly<Record<string, string>>
  readonly vitePluginSource: string
  readonly bindingVitePluginSource: string
  readonly classes: {
    surface: string
    surfaceHeader: string
    surfaceContent: string
    field: string
    fieldLabel: string
    fieldRequired: string
    fieldError: string
    surfaceTitle: string
    overlay: string
    overlayUnmasked: string
    overlayPanel: string
    overlayPanelDialog: string
    overlayPanelDrawer: string
    overlayPanelDrawerLeft: string
    overlayPanelDrawerRight: string
    overlayPanelDrawerTop: string
    overlayPanelDrawerBottom: string
    overlayHeading: string
    overlayTitle: string
    overlayClose: string
  }
  themeSource: (theme: ProjectTheme) => string
  stylesSource: (theme: ProjectTheme) => string
  rawEntrySource: (input: {
    imports: readonly string[]
    styleImports: readonly string[]
    libraryUses: readonly string[]
  }) => string
  bindingEntrySource: (styleImports: readonly string[]) => string
  layoutAttributes: (
    node: EmitStyleContext['node'],
    resolution: SourceComponentResolution,
  ) => { className?: string, style?: Record<string, string> }
  bindingAttributes: () => {
    formAttrs: Record<string, string>
    layoutAttrs: Record<string, string>
    cellAttrs: Record<string, string>
    fieldAttrs: Record<string, string>
  }
}

export interface SourceStyleBackendOptions {
  target?: SourceStyleTarget
}

export interface CollectedSourceDatasets {
  datasets: Readonly<Record<string, readonly ModelJsonObject[]>>
  views: Readonly<Record<string, {
    readonly items: readonly ModelJsonObject[]
    readonly total: number
  }>>
}

export interface ResolvedSourceComponents {
  byKey: ReadonlyMap<string, SourceComponentResolution>
  dependencies: Readonly<Record<string, string>>
}

export interface CollectedSourceResources {
  files: readonly SourceBinaryFile[]
  values: ReadonlyMap<
    string,
    { kind: 'embedded', fileName: string } | { kind: 'url', url: string }
  >
}

export interface SourceValidationFieldEmission {
  readonly nodeId: string
  /** Strictly parsed current RuleSet used by binding output and Raw code generation. */
  readonly ruleSet: RuleSet
  readonly attachValidator: boolean
}

export interface SourceValidationSurfaceEmission {
  readonly surfaceId: string
  readonly fields: readonly SourceValidationFieldEmission[]
}

export interface SourceValidationEmissionPlan {
  readonly surfaces: readonly SourceValidationSurfaceEmission[]
}
