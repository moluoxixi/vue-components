<script setup lang="ts">
import type { ProjectVersionSummary } from '@moluoxixi/config-form-model'
import type { PersistenceDialogEmits, PersistenceDialogProps, PersistenceRecoveryDraftSummary } from './types'
import { Check, History, RotateCcw, Trash2 } from '@lucide/vue'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import WorkbenchCommandHint from '../../components/WorkbenchCommandHint/index.vue'

const props = defineProps<PersistenceDialogProps>()

const emit = defineEmits<PersistenceDialogEmits>()

const versions = ref<ProjectVersionSummary[]>([])
const drafts = ref<PersistenceRecoveryDraftSummary[]>([])
const selectedRevision = ref<number>()
const selectedSource = ref('')
const checkpointLabel = ref('')
const versionLabel = ref('')
const loading = ref(false)
const inspecting = ref(false)
const dialogContent = useTemplateRef<HTMLElement>('dialog-content')

async function focusDialog(): Promise<void> {
  await nextTick()
  const content = dialogContent.value
  const target = content?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)') ?? content
  target?.focus()
}
const locale = props.controller.workbenchLocale
const busyReason = computed(() => props.controller.busy.value ? locale.value.t('action.processing', 'An operation is in progress. Wait for it to finish.') : undefined)
const open = computed(() => !!props.mode)
const selectedVersion = computed(() =>
  versions.value.find(version => version.repositoryRevision === selectedRevision.value))
const restoreUnavailableReason = computed(() => busyReason.value
  || (inspecting.value ? locale.value.t('status.loading', 'Loading') : !selectedSource.value ? locale.value.t('save.versionUnavailable', 'Version unavailable') : undefined))
const dialogTitle = computed(() => props.mode === 'checkpoint'
  ? locale.value.t('save.checkpoint', 'Create named checkpoint')
  : props.mode === 'versions'
    ? locale.value.t('save.history', 'Version history')
    : locale.value.t('recovery.title', 'Recovery drafts'))

async function loadVersions(): Promise<void> {
  loading.value = true
  try {
    versions.value = await props.controller.listProjectVersions()
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
    drafts.value = await props.controller.listRecoveryDrafts()
  }
  finally {
    loading.value = false
  }
}

async function loadSelectedVersion(): Promise<void> {
  const revision = selectedRevision.value
  selectedSource.value = ''
  if (revision === undefined) {
    inspecting.value = false
    return
  }
  inspecting.value = true
  try {
    const version = await props.controller.inspectProjectVersion(revision)
    if (selectedRevision.value === revision)
      selectedSource.value = version ? JSON.stringify(version.document, null, 2) : ''
  }
  finally {
    if (selectedRevision.value === revision)
      inspecting.value = false
  }
}

async function selectVersion(version: ProjectVersionSummary): Promise<void> {
  selectedRevision.value = version.repositoryRevision
  versionLabel.value = version.label ?? ''
  await loadSelectedVersion()
}

async function submitCheckpoint(): Promise<void> {
  if (!checkpointLabel.value.trim())
    return
  await props.controller.createNamedCheckpoint(checkpointLabel.value)
  checkpointLabel.value = ''
  emit('close')
}

async function updateVersionLabel(clear = false): Promise<void> {
  if (selectedRevision.value === undefined)
    return
  await props.controller.setProjectVersionLabel(
    selectedRevision.value,
    clear ? undefined : versionLabel.value,
  )
  await loadVersions()
}

async function restoreVersion(): Promise<void> {
  if (selectedRevision.value === undefined)
    return
  await props.controller.restoreProjectVersion(selectedRevision.value)
  emit('close')
}

async function restoreDraft(draftId: string): Promise<void> {
  await props.controller.restoreRecoveryDraft(draftId)
  emit('close')
}

async function discardDraft(draftId: string): Promise<void> {
  await props.controller.discardRecoveryDraft(draftId)
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
    :class="props.mode ? `persistence-dialog--${props.mode}` : undefined"
    :model-value="open"
    :title="dialogTitle"
    :width="props.mode === 'checkpoint' ? 'min(520px, calc(var(--wb-viewport-width) - 32px))' : 'min(980px, calc(var(--wb-viewport-width) - 32px))'"
    align-center
    append-to="#workbench-overlays"
    transition="none"
    @opened="focusDialog"
    @close="emit('close')"
  >
    <form v-if="props.mode === 'checkpoint'" ref="dialog-content" class="checkpoint-form" tabindex="-1" @submit.prevent="submitCheckpoint">
      <label for="checkpoint-name">{{ locale.t('save.checkpointName', 'Checkpoint name') }}</label>
      <ElInput
        id="checkpoint-name"
        v-model="checkpointLabel"
        maxlength="80"
        autocomplete="off"
        :placeholder="locale.t('save.checkpointPlaceholder', 'For example: Ready for review')"
      />
      <footer>
        <ElButton native-type="button" @click="emit('close')">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <WorkbenchCommandHint detached :label="locale.t('save.createCheckpoint', 'Create checkpoint')" :disabled-reason="busyReason || (!checkpointLabel.trim() ? locale.t('save.checkpointRequired', 'Enter a checkpoint name to create it.') : undefined)">
          <ElButton native-type="submit" type="primary" :disabled="!checkpointLabel.trim() || props.controller.busy.value">
            <Check :size="15" aria-hidden="true" />
            {{ locale.t('save.createCheckpoint', 'Create checkpoint') }}
          </ElButton>
        </WorkbenchCommandHint>
      </footer>
    </form>

    <div v-else-if="props.mode === 'versions'" ref="dialog-content" class="version-history-layout" tabindex="-1" :aria-busy="loading">
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
            <strong>v{{ version.repositoryRevision }} · {{ version.label || locale.t(`save.source.${version.source}`, version.source) }}</strong>
            <small>{{ new Date(version.createdAt).toLocaleString() }}</small>
          </span>
        </ElButton>
      </nav>
      <section class="version-inspector">
        <div v-if="selectedVersion" class="version-label-editor">
          <label for="version-label">{{ locale.t('save.versionLabel', 'Version label') }}</label>
          <div>
            <ElInput id="version-label" v-model="versionLabel" maxlength="80" />
            <WorkbenchCommandHint detached :label="locale.t('action.save', 'Save')" :disabled-reason="busyReason || (!versionLabel.trim() ? locale.t('save.labelRequired', 'Enter a version label to save it.') : undefined)">
              <ElButton native-type="button" :disabled="!versionLabel.trim() || props.controller.busy.value" @click="updateVersionLabel(false)">
                {{ locale.t('action.save', 'Save') }}
              </ElButton>
            </WorkbenchCommandHint>
            <WorkbenchCommandHint detached anchor-class="version-label-remove" :label="locale.t('save.removeLabel', 'Remove label')" :disabled-reason="busyReason || (!selectedVersion.label ? locale.t('save.noLabel', 'This version has no label to remove.') : undefined)">
              <ElButton native-type="button" :disabled="!selectedVersion.label || props.controller.busy.value" @click="updateVersionLabel(true)">
                {{ locale.t('save.removeLabel', 'Remove label') }}
              </ElButton>
            </WorkbenchCommandHint>
          </div>
        </div>
        <pre tabindex="0" :aria-busy="inspecting" :aria-label="locale.t('save.versionContent', 'Version content')">{{ inspecting ? locale.t('status.loading', 'Loading') : selectedSource || locale.t('save.versionUnavailable', 'Version unavailable') }}</pre>
        <footer>
          <p>{{ locale.t('save.restoreHint', 'Restoring creates a new version and keeps the current history.') }}</p>
          <WorkbenchCommandHint detached :label="locale.t('save.restoreVersion', 'Restore as new version')" :disabled-reason="restoreUnavailableReason">
            <ElButton native-type="button" type="primary" :disabled="!!restoreUnavailableReason" @click="restoreVersion">
              <RotateCcw :size="15" aria-hidden="true" />
              {{ locale.t('save.restoreVersion', 'Restore as new version') }}
            </ElButton>
          </WorkbenchCommandHint>
        </footer>
      </section>
    </div>

    <div v-else ref="dialog-content" class="recovery-draft-list" tabindex="-1" :aria-busy="loading">
      <ElEmpty v-if="drafts.length === 0" :description="locale.t('recovery.empty', 'No recovery drafts found.')" :image-size="48" />
      <article v-for="draft in drafts" :key="draft.draftId" :data-presence="draft.presence">
        <div>
          <strong>{{ new Date(draft.updatedAt).toLocaleString() }}</strong>
          <span>v{{ draft.baseRepositoryRevision }} · {{ draft.changedSurfaceIds.length }} surfaces · {{ draft.changedNodeCount }} nodes</span>
          <small>{{ draft.presence === 'active'
            ? locale.t('recovery.active', 'Open in another tab')
            : draft.presence === 'unknown'
              ? locale.t('recovery.unknown', 'Session status cannot be confirmed')
              : locale.t('recovery.inactive', 'Recoverable draft') }}</small>
        </div>
        <div>
          <WorkbenchCommandHint detached :label="locale.t('recovery.restore', 'Recover')" :disabled-reason="busyReason || (draft.presence === 'active' ? locale.t('recovery.activeReason', 'This draft is open in another tab. Close that tab before recovering or discarding it.') : undefined)">
            <ElButton native-type="button" :disabled="draft.presence === 'active' || props.controller.busy.value" @click="restoreDraft(draft.draftId)">
              <RotateCcw :size="15" aria-hidden="true" />
              {{ locale.t('recovery.restore', 'Recover') }}
            </ElButton>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint detached :label="locale.t('recovery.discard', 'Discard')" :disabled-reason="busyReason || (draft.presence === 'active' ? locale.t('recovery.activeReason', 'This draft is open in another tab. Close that tab before recovering or discarding it.') : draft.presence === 'unknown' ? locale.t('recovery.unknownReason', 'Session status is unconfirmed. Reopen recovery after confirming the other tab is closed.') : undefined)">
            <ElButton native-type="button" :disabled="draft.presence !== 'inactive' || props.controller.busy.value" @click="discardDraft(draft.draftId)">
              <Trash2 :size="15" aria-hidden="true" />
              {{ locale.t('recovery.discard', 'Discard') }}
            </ElButton>
          </WorkbenchCommandHint>
        </div>
      </article>
    </div>
  </ElDialog>
</template>
