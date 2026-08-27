<script setup lang="ts">
import type { CandidateState, RequestStatus } from '../state'
import type { I18nDiagnostic, TranslationUnit } from '../../core'
import type { SanitizedConfigResponse, ScanResponse, ScanUnitGapWire } from '../../shared/protocol'
import { computed } from 'vue'
import { Eye, RotateCcw, Sparkles, Square } from '@lucide/vue'

const props = defineProps<{
  candidates: readonly CandidateState[]
  config?: SanitizedConfigResponse
  diagnostics: readonly I18nDiagnostic[]
  progress: { completed: number, total: number }
  scan?: ScanResponse
  selectedUnitIds: readonly string[]
  status: RequestStatus
  targetLocale?: string
}>()

const emit = defineEmits<{
  acceptCandidate: [sourceUnitId: string, accepted: boolean]
  editCandidate: [sourceUnitId: string, value: string]
  overwriteCandidate: [sourceUnitId: string, approved: boolean]
  preview: []
  retry: []
  selectionChange: [unitIds: readonly string[]]
  stop: []
  targetChange: [locale: string]
  translate: []
}>()

interface TranslationRow {
  candidate?: CandidateState
  gap?: ScanUnitGapWire
  target?: TranslationUnit
  unit: TranslationUnit
}

const rows = computed<TranslationRow[]>(() => {
  if (!props.scan || !props.config || !props.targetLocale)
    return []
  const targetUnits = new Map(props.scan.units.map(unit => [unit.id, unit]))
  const candidates = new Map(props.candidates.map(candidate => [candidate.sourceUnitId, candidate]))
  const gaps = new Map(
    props.scan.unitGaps
      .filter(gap => gap.targetLocale === props.targetLocale)
      .map(gap => [gap.sourceUnitId, gap]),
  )
  return props.scan.units
    .filter(unit => unit.locale === props.config!.resources.sourceLocale)
    .map(unit => ({
      candidate: candidates.get(unit.id),
      gap: gaps.get(unit.id),
      target: gaps.get(unit.id)?.targetUnitId ? targetUnits.get(gaps.get(unit.id)!.targetUnitId!) : undefined,
      unit,
    }))
})

const selected = computed(() => new Set(props.selectedUnitIds))
const acceptedCandidates = computed(() => props.candidates.filter(candidate => candidate.accepted && candidate.valid))
const canPreview = computed(() => acceptedCandidates.value.length > 0 && acceptedCandidates.value.every((candidate) => {
  const gap = props.scan?.unitGaps.find(item => item.sourceUnitId === candidate.sourceUnitId && item.targetLocale === props.targetLocale)
  return gap?.status !== 'existing' || candidate.overwriteApproved
}))
const retryable = computed(() => props.diagnostics.some(item => item.severity === 'error') || props.candidates.some(candidate => !candidate.valid))

function toggleSelection(unitId: string, checked: boolean): void {
  const next = new Set(props.selectedUnitIds)
  if (checked)
    next.add(unitId)
  else
    next.delete(unitId)
  emit('selectionChange', [...next])
}
</script>

<template>
  <section
    id="panel-translate"
    class="workspace-view translate-view"
    role="tabpanel"
    aria-labelledby="tab-translate"
    tabindex="0"
  >
    <header class="view-heading translate-heading-row">
      <div>
        <h2 id="translate-heading">Translate</h2>
        <p>Review source messages and generate candidates for one target locale.</p>
      </div>
      <el-select
        v-if="config"
        :model-value="targetLocale"
        aria-label="Target locale"
        class="locale-select"
        @update:model-value="emit('targetChange', String($event))"
      >
        <el-option v-for="locale in config.resources.targetLocales" :key="locale" :label="locale" :value="locale" />
      </el-select>
    </header>

    <div class="command-bar" aria-label="Translation commands">
      <el-button
        type="primary"
        :disabled="selectedUnitIds.length === 0 || status === 'loading' || config?.ai.status !== 'configured'"
        @click="emit('translate')"
      >
        <Sparkles :size="17" aria-hidden="true" />
        Translate {{ selectedUnitIds.length }}
      </el-button>
      <el-tooltip content="Stop active translation">
        <span class="tooltip-trigger">
          <el-button
            class="icon-button"
            circle
            :disabled="status !== 'loading'"
            aria-label="Stop active translation"
            @click="emit('stop')"
          >
            <Square :size="16" aria-hidden="true" />
          </el-button>
        </span>
      </el-tooltip>
      <el-tooltip content="Retry failed messages">
        <span class="tooltip-trigger">
          <el-button
            class="icon-button"
            circle
            :disabled="!retryable || status === 'loading'"
            aria-label="Retry failed messages"
            @click="emit('retry')"
          >
            <RotateCcw :size="16" aria-hidden="true" />
          </el-button>
        </span>
      </el-tooltip>
      <el-button :disabled="!canPreview || status === 'loading'" @click="emit('preview')">
        <Eye :size="17" aria-hidden="true" />
        Preview changes
      </el-button>
      <span v-if="status === 'loading'" class="progress-label" role="status">
        {{ progress.completed }} / {{ progress.total }} translated
      </span>
      <span v-else-if="status === 'cancelled'" class="progress-label is-warning" role="status">Translation stopped</span>
    </div>

    <div v-if="diagnostics.length" class="diagnostic-list" role="alert">
      <p v-for="(diagnostic, index) in diagnostics" :key="`${diagnostic.code}-${index}`">
        <strong>{{ diagnostic.code }}</strong> {{ diagnostic.message }}
      </p>
    </div>

    <div v-if="rows.length" class="translation-table" role="table" aria-label="Translation messages">
      <div class="translation-row translation-header" role="row">
        <span role="columnheader">Select</span>
        <span role="columnheader">Key</span>
        <span role="columnheader">Source</span>
        <span role="columnheader">Candidate</span>
        <span role="columnheader">Review</span>
      </div>
      <div v-for="row in rows" :key="row.unit.id" class="translation-row" role="row">
        <label class="selection-cell" :aria-label="`Select ${row.unit.path.join('.')}`">
          <input
            type="checkbox"
            :checked="selected.has(row.unit.id)"
            @change="toggleSelection(row.unit.id, ($event.target as HTMLInputElement).checked)"
          >
        </label>
        <div class="key-cell" role="cell" data-label="Key">
          <code>{{ row.unit.path.join('.') }}</code>
          <small>{{ row.unit.namespace ?? row.unit.origin.relativePath }}</small>
          <span class="status-text" :class="`is-${row.gap?.status ?? 'missing'}`">{{ row.gap?.status ?? 'missing' }}</span>
        </div>
        <div class="source-cell" role="cell" data-label="Source">
          <p>{{ row.unit.value }}</p>
          <small v-if="row.target">Current: {{ row.target.value }}</small>
        </div>
        <div class="candidate-cell" role="cell" data-label="Candidate">
          <el-input
            v-if="row.candidate"
            :aria-label="`Candidate translation for ${row.unit.path.join('.')}`"
            :model-value="row.candidate.value"
            type="textarea"
            :rows="2"
            :class="{ 'is-invalid': !row.candidate.valid }"
            @update:model-value="emit('editCandidate', row.unit.id, String($event))"
          />
          <span v-else class="muted">Not generated</span>
        </div>
        <div class="review-cell" role="cell" data-label="Review">
          <label v-if="row.candidate" class="check-label">
            <input
              type="checkbox"
              :checked="row.candidate.accepted"
              :disabled="!row.candidate.valid"
              @change="emit('acceptCandidate', row.unit.id, ($event.target as HTMLInputElement).checked)"
            >
            Accept
          </label>
          <label v-if="row.candidate && row.gap?.status === 'existing'" class="check-label is-warning">
            <input
              type="checkbox"
              :checked="row.candidate.overwriteApproved"
              @change="emit('overwriteCandidate', row.unit.id, ($event.target as HTMLInputElement).checked)"
            >
            Allow overwrite
          </label>
          <span v-if="row.candidate && !row.candidate.valid" class="status-text is-error">Token mismatch</span>
        </div>
      </div>
    </div>

    <div v-else class="view-state" role="status">Scan locale resources to begin.</div>
  </section>
</template>
