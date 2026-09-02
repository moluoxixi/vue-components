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

export type StudioLeftView = 'components' | 'history' | 'layers' | 'pages'
export type StudioLayerAction = 'indent' | 'moveAfter' | 'moveBefore' | 'outdent'

export interface StudioLayerEntry {
  component: string
  depth: number
  id: string
  label: string
}

export interface StudioLeftPanelProps {
  activeView?: StudioLeftView
  currentPageId: string
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
  'managePages': []
  'selectLayer': [nodeId: string, mode: DesignerSelectionMode]
  'selectPage': [pageId: string]
  'update:activeView': [view: StudioLeftView]
}
