<script setup lang="ts">
import type { RequestStatus } from '../state'
import type { PreviewResponse } from '../../shared/protocol'
import { computed, nextTick, ref } from 'vue'
import { Check, FileDiff, RefreshCw } from '@lucide/vue'

const props = defineProps<{
  applyStatus: RequestStatus
  preview?: PreviewResponse
  previewStatus: RequestStatus
}>()

const emit = defineEmits<{
  apply: []
  refresh: []
}>()

const confirmOpen = ref(false)
const applyTrigger = ref<HTMLElement>()
const cancelTarget = ref<HTMLElement>()
const operationCount = computed(() => props.preview?.files.reduce((total, file) => total + file.operations.length, 0) ?? 0)
const overwriteCount = computed(() => props.preview?.files.reduce(
  (total, file) => total + file.operations.filter(operation => operation.overwriteRequired).length,
  0,
) ?? 0)

function confirmApply(): void {
  confirmOpen.value = false
  emit('apply')
}

function focusDialog(): void {
  void nextTick(() => cancelTarget.value?.querySelector('button')?.focus())
}

function restoreApplyFocus(): void {
  void nextTick(() => applyTrigger.value?.querySelector('button')?.focus())
}
</script>

<template>
  <section
    id="panel-changes"
    class="workspace-view changes-view"
    role="tabpanel"
    aria-labelledby="tab-changes"
    tabindex="0"
  >
    <header class="view-heading">
      <div>
        <h2 id="changes-heading">Changes</h2>
        <p>Inspect every file operation before writing to disk.</p>
      </div>
      <div class="heading-actions">
        <el-button @click="emit('refresh')">
          <RefreshCw :size="17" aria-hidden="true" />
          Rebuild preview
        </el-button>
        <span ref="applyTrigger" class="focus-wrapper">
          <el-button
            type="primary"
            :disabled="!preview?.previewToken || previewStatus !== 'ready'"
            :loading="applyStatus === 'loading'"
            @click="confirmOpen = true"
          >
            <Check :size="17" aria-hidden="true" />
            Apply changes
          </el-button>
        </span>
      </div>
    </header>

    <div v-if="previewStatus === 'loading'" class="view-state" role="status">
      <el-skeleton :rows="6" animated />
    </div>

    <div v-else-if="preview?.files.length" class="diff-list">
      <article v-for="file in preview.files" :key="file.resourceId" class="diff-item">
        <header>
          <FileDiff :size="18" aria-hidden="true" />
          <code>{{ file.relativePath }}</code>
          <span class="operation-kind" :class="`is-${file.type}`">{{ file.type }}</span>
          <span>{{ file.operations.length }} operations</span>
        </header>
        <ul class="operation-list" :aria-label="`Operations for ${file.relativePath}`">
          <li v-for="operation in file.operations" :key="operation.targetUnitId">
            <span
              class="operation-kind"
              :class="operation.overwriteRequired ? 'is-overwrite' : `is-${operation.type}`"
            >
              {{ operation.overwriteRequired ? 'overwrite' : operation.type }}
            </span>
            <code>{{ operation.jsonPointer }}</code>
            <span class="operation-values">
              <del v-if="operation.before !== undefined">{{ operation.before }}</del>
              <span>{{ operation.after }}</span>
            </span>
          </li>
        </ul>
        <pre tabindex="0" :aria-label="`Diff for ${file.relativePath}`">{{ file.diff }}</pre>
      </article>
    </div>

    <div
      v-else
      class="view-state"
      :class="{ 'is-error': previewStatus === 'error' }"
      :role="previewStatus === 'error' ? 'alert' : 'status'"
    >
      No valid preview is available.
    </div>

    <el-dialog
      v-model="confirmOpen"
      title="Write locale files?"
      width="min(460px, calc(100vw - 32px))"
      destroy-on-close
      @opened="focusDialog"
      @closed="restoreApplyFocus"
    >
      <p>This will write {{ operationCount }} translations across {{ preview?.files.length ?? 0 }} files.</p>
      <p v-if="overwriteCount" class="dialog-warning">
        {{ overwriteCount }} existing translations will be overwritten.
      </p>
      <template #footer>
        <span ref="cancelTarget" class="focus-wrapper">
          <el-button autofocus @click="confirmOpen = false">Cancel</el-button>
        </span>
        <el-button type="primary" @click="confirmApply">Confirm write</el-button>
      </template>
    </el-dialog>
  </section>
</template>
