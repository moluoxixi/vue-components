import type { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { PersistedProjectEnvelope, ProjectVersionSummary } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'
import type { ProjectRecoveryDraftSummary } from '../../../project'
import type { PersistenceDialogMode } from './domain'

export interface PersistenceRecoveryDraftSummary extends ProjectRecoveryDraftSummary {
  presence: 'active' | 'inactive' | 'unknown'
}

export interface PersistenceDialogController {
  busy: Ref<boolean>
  createNamedCheckpoint: (label: string) => Promise<void>
  discardRecoveryDraft: (draftId: string) => Promise<void>
  inspectProjectVersion: (revision: number) => Promise<PersistedProjectEnvelope | undefined>
  listProjectVersions: () => Promise<ProjectVersionSummary[]>
  listRecoveryDrafts: () => Promise<PersistenceRecoveryDraftSummary[]>
  restoreProjectVersion: (revision: number) => Promise<void>
  restoreRecoveryDraft: (draftId: string) => Promise<void>
  setProjectVersionLabel: (revision: number, label?: string) => Promise<void>
  workbenchLocale: ComputedRef<ReturnType<typeof createDesignerLocale>>
}

export interface PersistenceDialogProps {
  controller: PersistenceDialogController
  mode?: PersistenceDialogMode
}
