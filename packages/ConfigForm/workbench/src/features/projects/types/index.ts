import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'

export interface ProjectManagerController {
  busy: Readonly<Ref<boolean>>
  currentProject: Readonly<Ref<{ id: string } | undefined>>
  initialized: Readonly<Ref<boolean>>
  localeOptions: ComputedRef<DesignerLocaleOptions>
  projects: Readonly<Ref<ProjectSummary[]>>
  deleteProject: (projectId: string) => Promise<boolean>
  duplicateProject: (projectId: string) => Promise<boolean>
  exportProject: (projectId: string) => Promise<string | undefined>
  renameProject: (projectId: string, name: string) => Promise<boolean>
  requestOpenProject: (projectId: string) => Promise<void>
}

export interface ProjectManagerUi {
  clearMessage: () => void
  message: Readonly<Ref<string>>
  paletteFamily: Readonly<Ref<string>>
  resolvedTheme: Readonly<Ref<string>>
}

export interface ProjectManagerProps {
  controller: ProjectManagerController
  ui: ProjectManagerUi
}

export interface ProjectManagerEmits {
  create: [mode: 'json' | 'template']
  open: []
}
