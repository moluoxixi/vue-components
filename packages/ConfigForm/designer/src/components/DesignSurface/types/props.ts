import type {
  ComponentContractRegistry,
  DeepReadonly,
  ProjectDataset,
  ProjectResource,
  ProjectSurface,
  SurfaceGraph,
} from '@moluoxixi/config-form-model'
import type { Component } from 'vue'
import type { DesignerLocaleOptions } from '../../../locale'
import type { DesignerRegistry } from '../../../registry'
import type { DesignerInteractionSurfaceOption } from '../../DesignerPropertyPanel/types'
import type { DesignerCommandControl, DesignerHistoryControl } from './domain'

export interface DesignSurfaceProps {
  commandHint?: Component
  commandControl: DesignerCommandControl
  componentRegistry: ComponentContractRegistry
  datasets?: readonly DeepReadonly<ProjectDataset>[]
  graph: SurfaceGraph
  historyControl: DesignerHistoryControl
  locale?: DesignerLocaleOptions
  surfaceId: string
  surface?: ProjectSurface
  surfaces?: readonly DesignerInteractionSurfaceOption[]
  readonly?: boolean
  registry: DesignerRegistry
  renderer: Component
  resources?: readonly DeepReadonly<ProjectResource>[]
  workspaceNavigation?: 'external' | 'internal'
}
