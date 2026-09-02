<script setup lang="ts">
import type { ProjectVersionSummary } from '@moluoxixi/config-form-model'
import type { WorkbenchRecoveryDraftSummary } from '../../app'
import type { PersistenceDialogEmits, PersistenceDialogProps } from './types'
import { Check, History, RotateCcw, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useWorkbenchController } from '../../app'

const props = defineProps<PersistenceDialogProps>()

const emit = defineEmits<PersistenceDialogEmits>()

const controller = useWorkbenchController()
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
const dialogTitle = computed(() => props.mode === 'checkpoint'
  ? locale.value.t('save.checkpoint', 'Create named checkpoint')
  : props.mode === 'versions'
    ? locale.value.t('save.history', 'Version history')
    : locale.value.t('recovery.title', 'Recovery drafts'))

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
  <ElDialog
    class="persistence-dialog"
    :class="mode ? `persistence-dialog--${mode}` : undefined"
    :model-value="open"
    :title="dialogTitle"
    width="min(980px, calc(100vw - 32px))"
    append-to="#workbench-overlays"
    transition="none"
    @close="emit('close')"
  >
    <form v-if="mode === 'checkpoint'" class="checkpoint-form" @submit.prevent="submitCheckpoint">
      <label for="checkpoint-name">{{ locale.t('save.checkpointName', 'Checkpoint name') }}</label>
      <ElInput
        id="checkpoint-name"
        v-model="checkpointLabel"
        maxlength="80"
        autocomplete="off"
        :placeholder="locale.t('save.checkpointPlaceholder', 'For example: Ready for review')"
      />
      <footer>
        <ElButton native-type="button" @click="emit('close')">{{ locale.t('action.cancel', 'Cancel') }}</ElButton>
        <ElButton native-type="submit" type="primary" :disabled="!checkpointLabel.trim() || controller.busy.value">
          <Check :size="15" aria-hidden="true" />
          {{ locale.t('save.createCheckpoint', 'Create checkpoint') }}
        </ElButton>
      </footer>
    </form>

    <div v-else-if="mode === 'versions'" class="version-history-layout" :aria-busy="loading">
      <nav :aria-label="locale.t('save.history', 'Version history')">
        <ElButton
          v-for="version in versions"
          :key="version.repositoryRevision"
          native-type="button"
          :class="{ 'is-active': version.repositoryRevision === selectedRevision }"
          @click="selectVersion(version)"
        >
          <History :size="15" aria-hidden="true" />
          <span>
            <strong>v{{ version.repositoryRevision }} · {{ version.label || version.source }}</strong>
            <small>{{ new Date(version.createdAt).toLocaleString() }}</small>
          </span>
        </ElButton>
      </nav>
      <section class="version-inspector">
        <div v-if="selectedVersion" class="version-label-editor">
          <label for="version-label">{{ locale.t('save.versionLabel', 'Version label') }}</label>
          <div>
            <ElInput id="version-label" v-model="versionLabel" maxlength="80" />
            <ElButton native-type="button" :disabled="!versionLabel.trim()" @click="updateVersionLabel(false)">
              {{ locale.t('action.save', 'Save') }}
            </ElButton>
            <ElButton native-type="button" :disabled="!selectedVersion.label" @click="updateVersionLabel(true)">
              {{ locale.t('save.removeLabel', 'Remove label') }}
            </ElButton>
          </div>
        </div>
        <pre tabindex="0">{{ selectedSource || locale.t('save.versionUnavailable', 'Version unavailable') }}</pre>
        <footer>
          <p>{{ locale.t('save.restoreHint', 'Restoring creates a new version and keeps the current history.') }}</p>
          <ElButton native-type="button" type="primary" :disabled="selectedRevision === undefined || controller.busy.value" @click="restoreVersion">
            <RotateCcw :size="15" aria-hidden="true" />
            {{ locale.t('save.restoreVersion', 'Restore as new version') }}
          </ElButton>
        </footer>
      </section>
    </div>

    <div v-else class="recovery-draft-list" :aria-busy="loading">
      <ElEmpty v-if="drafts.length === 0" :description="locale.t('recovery.empty', 'No recovery drafts found.')" :image-size="48" />
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
          <ElButton native-type="button" :disabled="draft.presence === 'active' || controller.busy.value" @click="restoreDraft(draft.draftId)">
            <RotateCcw :size="15" aria-hidden="true" />
            {{ locale.t('recovery.restore', 'Recover') }}
          </ElButton>
          <ElButton native-type="button" :disabled="draft.presence !== 'inactive' || controller.busy.value" @click="discardDraft(draft.draftId)">
            <Trash2 :size="15" aria-hidden="true" />
            {{ locale.t('recovery.discard', 'Discard') }}
          </ElButton>
        </div>
      </article>
    </div>
  </ElDialog>
</template>
