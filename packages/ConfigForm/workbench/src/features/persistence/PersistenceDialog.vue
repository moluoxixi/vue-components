<script setup lang="ts">
import type { ProjectVersionSummary } from '@moluoxixi/config-form-model'
import type { WorkbenchRecoveryDraftSummary } from '../../app/workbench-controller'
import { Check, History, RotateCcw, Trash2, X } from '@lucide/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'
import { useWorkbenchController } from '../../app/workbench-context'

export type PersistenceDialogMode = 'checkpoint' | 'recovery' | 'versions'

const props = defineProps<{
  mode?: PersistenceDialogMode
}>()

const emit = defineEmits<{
  close: []
}>()

const controller = useWorkbenchController()
const dialog = useTemplateRef<HTMLElement>('dialog')
const versions = ref<ProjectVersionSummary[]>([])
const drafts = ref<WorkbenchRecoveryDraftSummary[]>([])
const selectedRevision = ref<number>()
const selectedSource = ref('')
const checkpointLabel = ref('')
const versionLabel = ref('')
const loading = ref(false)
const locale = controller.workbenchLocale
const open = computed(() => !!props.mode)
const selectedVersion = computed(() =>
  versions.value.find(version => version.repositoryRevision === selectedRevision.value))
const { handleKeydown } = useWorkbenchDialogFocus(
  () => open.value,
  dialog,
  () => emit('close'),
)

async function loadVersions(): Promise<void> {
  loading.value = true
  try {
    versions.value = await controller.listProjectVersions()
    selectedRevision.value = versions.value[0]?.repositoryRevision
    versionLabel.value = versions.value[0]?.label ?? ''
    await loadSelectedVersion()
  }
  finally {
    loading.value = false
  }
}

async function loadDrafts(): Promise<void> {
  loading.value = true
  try {
    drafts.value = await controller.listRecoveryDrafts()
  }
  finally {
    loading.value = false
  }
}

async function loadSelectedVersion(): Promise<void> {
  const revision = selectedRevision.value
  if (revision === undefined) {
    selectedSource.value = ''
    return
  }
  const version = await controller.inspectProjectVersion(revision)
  selectedSource.value = version ? JSON.stringify(version.document, null, 2) : ''
}

async function selectVersion(version: ProjectVersionSummary): Promise<void> {
  selectedRevision.value = version.repositoryRevision
  versionLabel.value = version.label ?? ''
  await loadSelectedVersion()
}

async function submitCheckpoint(): Promise<void> {
  if (!checkpointLabel.value.trim())
    return
  await controller.createNamedCheckpoint(checkpointLabel.value)
  checkpointLabel.value = ''
  emit('close')
}

async function updateVersionLabel(clear = false): Promise<void> {
  if (selectedRevision.value === undefined)
    return
  await controller.setProjectVersionLabel(
    selectedRevision.value,
    clear ? undefined : versionLabel.value,
  )
  await loadVersions()
}

async function restoreVersion(): Promise<void> {
  if (selectedRevision.value === undefined)
    return
  await controller.restoreProjectVersion(selectedRevision.value)
  emit('close')
}

async function restoreDraft(draftId: string): Promise<void> {
  await controller.restoreRecoveryDraft(draftId)
  emit('close')
}

async function discardDraft(draftId: string): Promise<void> {
  await controller.discardRecoveryDraft(draftId)
  await loadDrafts()
}

watch(() => props.mode, async (mode) => {
  if (mode === 'checkpoint')
    checkpointLabel.value = ''
  else if (mode === 'versions')
    await loadVersions()
  else if (mode === 'recovery')
    await loadDrafts()
}, { immediate: true })
</script>

<template>
  <div
    v-if="mode"
    ref="dialog"
    class="persistence-dialog-overlay"
    role="presentation"
    @click.self="emit('close')"
    @keydown="handleKeydown"
  >
    <section
      class="persistence-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`persistence-dialog-title-${mode}`"
    >
      <header>
        <div>
          <span>{{ locale.t('persistence.eyebrow', 'Project persistence') }}</span>
          <h2 :id="`persistence-dialog-title-${mode}`">
            {{ mode === 'checkpoint'
              ? locale.t('save.checkpoint', 'Create named checkpoint')
              : mode === 'versions'
                ? locale.t('save.history', 'Version history')
                : locale.t('recovery.title', 'Recovery drafts') }}
          </h2>
        </div>
        <button type="button" :aria-label="locale.t('action.close', 'Close')" @click="emit('close')">
          <X :size="17" aria-hidden="true" />
        </button>
      </header>

      <form v-if="mode === 'checkpoint'" class="checkpoint-form" @submit.prevent="submitCheckpoint">
        <label for="checkpoint-name">{{ locale.t('save.checkpointName', 'Checkpoint name') }}</label>
        <input
          id="checkpoint-name"
          v-model="checkpointLabel"
          maxlength="80"
          autocomplete="off"
          :placeholder="locale.t('save.checkpointPlaceholder', 'For example: Ready for review')"
        >
        <footer>
          <button type="button" @click="emit('close')">{{ locale.t('action.cancel', 'Cancel') }}</button>
          <button type="submit" class="is-primary" :disabled="!checkpointLabel.trim() || controller.busy.value">
            <Check :size="15" aria-hidden="true" />
            {{ locale.t('save.createCheckpoint', 'Create checkpoint') }}
          </button>
        </footer>
      </form>

      <div v-else-if="mode === 'versions'" class="version-history-layout" :aria-busy="loading">
        <nav :aria-label="locale.t('save.history', 'Version history')">
          <button
            v-for="version in versions"
            :key="version.repositoryRevision"
            type="button"
            :class="{ 'is-active': version.repositoryRevision === selectedRevision }"
            @click="selectVersion(version)"
          >
            <History :size="15" aria-hidden="true" />
            <span>
              <strong>v{{ version.repositoryRevision }} · {{ version.label || version.source }}</strong>
              <small>{{ new Date(version.createdAt).toLocaleString() }}</small>
            </span>
          </button>
        </nav>
        <section class="version-inspector">
          <div v-if="selectedVersion" class="version-label-editor">
            <label for="version-label">{{ locale.t('save.versionLabel', 'Version label') }}</label>
            <div>
              <input id="version-label" v-model="versionLabel" maxlength="80">
              <button type="button" :disabled="!versionLabel.trim()" @click="updateVersionLabel(false)">
                {{ locale.t('action.save', 'Save') }}
              </button>
              <button type="button" :disabled="!selectedVersion.label" @click="updateVersionLabel(true)">
                {{ locale.t('save.removeLabel', 'Remove label') }}
              </button>
            </div>
          </div>
          <pre tabindex="0">{{ selectedSource || locale.t('save.versionUnavailable', 'Version unavailable') }}</pre>
          <footer>
            <p>{{ locale.t('save.restoreHint', 'Restoring creates a new version and keeps the current history.') }}</p>
            <button type="button" class="is-primary" :disabled="selectedRevision === undefined || controller.busy.value" @click="restoreVersion">
              <RotateCcw :size="15" aria-hidden="true" />
              {{ locale.t('save.restoreVersion', 'Restore as new version') }}
            </button>
          </footer>
        </section>
      </div>

      <div v-else class="recovery-draft-list" :aria-busy="loading">
        <p v-if="drafts.length === 0" class="persistence-empty">
          {{ locale.t('recovery.empty', 'No recovery drafts found.') }}
        </p>
        <article v-for="draft in drafts" :key="draft.draftId" :data-presence="draft.presence">
          <div>
            <strong>{{ new Date(draft.updatedAt).toLocaleString() }}</strong>
            <span>v{{ draft.baseRepositoryRevision }} · {{ draft.changedPageIds.length }} pages · {{ draft.changedNodeCount }} nodes</span>
            <small>{{ draft.presence === 'active'
              ? locale.t('recovery.active', 'Open in another tab')
              : draft.presence === 'unknown'
                ? locale.t('recovery.unknown', 'Session status cannot be confirmed')
                : locale.t('recovery.inactive', 'Recoverable draft') }}</small>
          </div>
          <div>
            <button type="button" :disabled="draft.presence === 'active' || controller.busy.value" @click="restoreDraft(draft.draftId)">
              <RotateCcw :size="15" aria-hidden="true" />
              {{ locale.t('recovery.restore', 'Recover') }}
            </button>
            <button type="button" :disabled="draft.presence !== 'inactive' || controller.busy.value" @click="discardDraft(draft.draftId)">
              <Trash2 :size="15" aria-hidden="true" />
              {{ locale.t('recovery.discard', 'Discard') }}
            </button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
