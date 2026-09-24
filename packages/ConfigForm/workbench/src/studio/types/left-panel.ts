import type {
  DesignerLocaleOptions,
  DesignerMaterialDefinition,
  DesignerRegistry,
  DesignerSelectionMode,
} from '@moluoxixi/config-form-designer'
import type {
  FormSettings,
  ProjectHistorySummary,
  ReadonlyProjectDocument,
} from '@moluoxixi/config-form-model'

export type StudioLeftView = 'components' | 'history' | 'layers' | 'pages' | 'theme'
export type StudioLayerAction = 'indent' | 'moveAfter' | 'moveBefore' | 'outdent'

export interface StudioLayerEntry {
  canIndent: boolean
  canMoveAfter: boolean
  canMoveBefore: boolean
  canOutdent: boolean
  component: string
  depth: number
  id: string
  label: string
}

export interface StudioLeftPanelProps {
  activeView?: StudioLeftView
  currentSurfaceId: string
  form: FormSettings
  history?: ProjectHistorySummary
  layers: StudioLayerEntry[]
  locale?: DesignerLocaleOptions
  materials: DesignerMaterialDefinition[]
  project: ReadonlyProjectDocument
  readonly?: boolean
  registry: DesignerRegistry
  selectedIds: string[]
}

export interface StudioLeftPanelEmits {
  'addMaterial': [materialKey: string]
  'arrangeLayer': [action: StudioLayerAction, nodeId: string]
  'jumpHistory': [position: number]
  'manageAssets': [kind?: 'dataset' | 'resource', id?: string]
  'manageSurfaces': []
  'moveLayer': [nodeId: string, referenceId: string, position: 'after' | 'before']
  'selectLayer': [nodeId: string, mode: DesignerSelectionMode]
  'selectSurface': [surfaceId: string]
  'update:activeView': [view: StudioLeftView]
}
