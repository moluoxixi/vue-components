<script setup lang="ts">
import type {
  ConfigFormFlowActionDescriptor,
  ConfigFormFlowStep,
  ConfigFormReactionCondition,
} from '@moluoxixi/config-form-core'
import type {
  FlowTreeEntry,
  FlowWorkspaceDiagnostic,
  FlowWorkspaceEmits,
  FlowWorkspaceExpose,
  FlowWorkspaceProps,
} from './types'
import {
  ArrowDown,
  ArrowUp,
  CircleStop,
  Copy,
  GitBranch,
  Plus,
  Save,
  Trash2,
  Undo2,
  Workflow,
  Zap,
} from '@lucide/vue'
import { computed, nextTick, ref } from 'vue'
import { cloneWorkbenchJson as structuredClone } from '../../../../utils'
import { useFlowWorkspace } from './composables'
import {
  ActionInputs,
  ConditionEditor,
  ReactionEditor,
  StepPolicyEditor,
} from './components'

const props = defineProps<FlowWorkspaceProps>()
const emit = defineEmits<FlowWorkspaceEmits>()
const workspaceRoot = ref<HTMLElement>()
const workspace = useFlowWorkspace({ props, onClose: () => emit('close') })
const {
  actionDescriptors,
  addFlow,
  addStep,
  blocked,
  canEdit,
  canMove,
  cancel,
  changeActionDescriptor,
  confirmClose,
  descriptorTitle,
  diagnostics,
  dirty,
  draftMetadata,
  duplicateStep,
  eventArguments,
  invalidParameters,
  fields,
  flowTriggerLabel,
  hasDraft,
  locale,
  lockedTrigger,
  locateDiagnostic,
  moveStep,
  outputOptions,
  patchMetadata,
  patchSelectedStep,
  removed,
  removeStep,
  replaceSelectedStep,
  representable,
  requestClose,
  restoreRemovedFlow,
  save,
  saving,
  selectedDescriptor,
  selectedStep,
  selectedStepId,
  setStepInput,
  setStepReactions,
  stageRemoveFlow,
  stepTitle,
  steps,
  treeEntries,
  triggerConflict,
  updateConcurrency,
  updateFlowErrorPolicy,
  updateFlowTimeout,
  updateStepPolicy,
} = workspace

defineExpose<FlowWorkspaceExpose>({ confirmClose, requestClose, save })

type AddCommand = ConfigFormFlowStep['type']
const descriptorGroups = computed(() => {
  const groups = new Map<string, ConfigFormFlowActionDescriptor[]>()
  actionDescriptors.value.forEach((descriptor) => {
    const items = groups.get(descriptor.category) ?? []
    items.push(descriptor)
    groups.set(descriptor.category, items)
  })
  return [...groups].map(([category, descriptors]) => ({ category, descriptors }))
})

function addToBranch(entry: Extract<FlowTreeEntry, { entryType: 'branch' }>, type: AddCommand): void {
  addStep(type, {
    parentId: entry.conditionId,
    branch: entry.branch,
    index: entry.index,
  })
}

function addAtRoot(type: AddCommand): void {
  addStep(type, { index: steps.value.length })
}

function depthStyle(depth: number): Record<string, string> {
  return { '--flow-depth': String(depth) }
}

function stepIcon(step: ConfigFormFlowStep) {
  if (step.type === 'condition')
    return GitBranch
  if (step.type === 'reaction')
    return Zap
  if (step.type === 'terminate')
    return CircleStop
  return Workflow
}

function stepTypeLabel(step: ConfigFormFlowStep): string {
  if (step.type === 'condition')
    return locale.value.t('flow.step.condition', 'Condition')
  if (step.type === 'reaction')
    return locale.value.t('flow.step.reaction', 'Update form')
  if (step.type === 'terminate')
    return locale.value.t('flow.step.terminate', 'Finish')
  return locale.value.t('flow.step.action', 'Action')
}

function updateTitle(value: string): void {
  const title = value.trim()
  patchSelectedStep(title ? { title } : { title: undefined })
}

function updateCondition(value: ConfigFormReactionCondition): void {
  const step = selectedStep.value
  if (step?.type === 'condition')
    replaceSelectedStep({ ...structuredClone(step), when: value })
}

function updateOutcome(value: unknown): void {
  const step = selectedStep.value
  if (step?.type === 'terminate' && (value === 'end' || value === 'success' || value === 'failure' || value === 'blocked'))
    replaceSelectedStep({ ...structuredClone(step), outcome: value })
}

function categoryTitle(category: string): string {
  return locale.value.t(`flow.actionCategory.${category}`, category)
}

function formatDiagnosticPath(path: FlowWorkspaceDiagnostic['path']): string {
  if (typeof path === 'string')
    return path
  return path ? path.map(String).join(' / ') : ''
}

async function activateDiagnostic(diagnostic: FlowWorkspaceDiagnostic): Promise<void> {
  const target = locateDiagnostic(diagnostic)
  await nextTick()
  const root = workspaceRoot.value
  if (!root)
    return
  const stepElement = target.stepId
    ? [...root.querySelectorAll<HTMLElement>('[data-step-id]')].find(element => element.dataset.stepId === target.stepId)
    : undefined
  if (stepElement && typeof stepElement.scrollIntoView === 'function')
    stepElement.scrollIntoView({ block: 'nearest' })
  if (target.parameter) {
    const parameter = [...root.querySelectorAll<HTMLElement>('[data-parameter]')]
      .find(element => element.dataset.parameter === target.parameter)
    const focusTarget = parameter?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? parameter
    if (focusTarget) {
      focusTarget.focus()
      return
    }
  }
  stepElement?.focus({ preventScroll: true })
}
</script>

<template>
  <section ref="workspaceRoot" class="flow-workspace" :aria-label="locale.t('flow.workspace', 'Event flow workspace')">
    <div v-if="diagnostics.length" class="flow-diagnostics" role="alert" aria-live="polite">
      <ElButton
        v-for="(diagnostic, index) in diagnostics"
        :key="`${diagnostic.code}-${formatDiagnosticPath(diagnostic.path)}-${index}`"
        class="flow-diagnostic"
        native-type="button"
        text
        @click="activateDiagnostic(diagnostic)"
      >
        <span class="flow-diagnostic-code">{{ diagnostic.code }}</span>
        <code v-if="diagnostic.path" class="flow-diagnostic-path">{{ formatDiagnosticPath(diagnostic.path) }}</code>
        <span class="flow-diagnostic-message">{{ diagnostic.message }}</span>
      </ElButton>
    </div>

    <div v-if="!hasDraft" class="flow-empty">
      <GitBranch :size="26" aria-hidden="true" />
      <strong>{{ locale.t('flow.empty.title', 'No flow configured for this event') }}</strong>
      <span>{{ flowTriggerLabel(lockedTrigger) }}</span>
      <ElButton type="primary" data-testid="create-first-flow" :disabled="readonly || triggerConflict" @click="addFlow">
        <Plus :size="15" aria-hidden="true" />
        {{ locale.t('flow.empty.action', 'Create event flow') }}
      </ElButton>
    </div>

    <template v-else>
      <div class="flow-workspace-body">
        <aside class="flow-event-settings" :aria-label="locale.t('flow.settings', 'Event settings')">
          <header>
            <strong>{{ locale.t('flow.settings', 'Event settings') }}</strong>
            <span v-if="dirty" class="flow-dirty-state">{{ locale.t('flow.unsaved', 'Unsaved') }}</span>
          </header>

          <label>
            <span>{{ locale.t('flow.name', 'Flow name') }}</span>
            <ElInput
              data-flow-control="name"
              :model-value="draftMetadata?.name"
              :disabled="!canEdit"
              :aria-label="locale.t('flow.name', 'Flow name')"
              @update:model-value="patchMetadata({ name: $event })"
            />
          </label>

          <div class="flow-locked-trigger" data-flow-control="locked-trigger">
            <span>{{ locale.t('flow.trigger', 'Event') }}</span>
            <strong>{{ flowTriggerLabel(lockedTrigger) }}</strong>
          </div>

          <label>
            <span>{{ locale.t('flow.concurrency', 'Repeated events') }}</span>
            <ElSelect :model-value="draftMetadata?.concurrency ?? 'latest'" :disabled="!canEdit" append-to="#workbench-overlays" @change="updateConcurrency">
              <ElOption value="latest" :label="locale.t('flow.concurrency.latest', 'Run the latest')" />
              <ElOption value="queue" :label="locale.t('flow.concurrency.queue', 'Run in order')" />
              <ElOption value="ignore" :label="locale.t('flow.concurrency.ignore', 'Ignore while running')" />
            </ElSelect>
          </label>

          <label>
            <span>{{ locale.t('flow.onError', 'Unhandled error') }}</span>
            <ElSelect :model-value="draftMetadata?.errorPolicy?.onError ?? 'failure'" :disabled="!canEdit" append-to="#workbench-overlays" @change="updateFlowErrorPolicy">
              <ElOption value="failure" :label="locale.t('flow.onError.failure', 'Finish as failure')" />
              <ElOption value="end" :label="locale.t('flow.onError.end', 'End the flow')" />
            </ElSelect>
          </label>

          <label>
            <span>{{ locale.t('flow.timeout', 'Flow timeout (ms)') }}</span>
            <ElInputNumber
              :model-value="draftMetadata?.errorPolicy?.timeoutMs ?? 10000"
              :disabled="!canEdit"
              :min="0"
              :step="100"
              controls-position="right"
              @change="updateFlowTimeout"
            />
          </label>

          <ElPopconfirm
            :title="locale.t('flow.deleteConfirm', 'Remove this event flow when you save?')"
            :confirm-button-text="locale.t('flow.delete', 'Remove flow')"
            :cancel-button-text="locale.t('action.cancel', 'Cancel')"
            :disabled="blocked || removed"
            @confirm="stageRemoveFlow"
          >
            <template #reference>
              <ElButton class="flow-danger-button" :disabled="blocked || removed" :title="locale.t('flow.delete', 'Remove flow')">
                <Trash2 :size="14" aria-hidden="true" />
                {{ locale.t('flow.delete', 'Remove flow') }}
              </ElButton>
            </template>
          </ElPopconfirm>
        </aside>

        <main class="flow-step-workspace" :aria-label="locale.t('flow.steps', 'Ordered steps')">
          <header class="flow-step-toolbar">
            <div>
              <strong>{{ locale.t('flow.steps', 'Ordered steps') }}</strong>
              <span>{{ locale.t('flow.stepCount', '{count} steps', { count: steps.length }) }}</span>
            </div>
            <div class="flow-add-actions" role="toolbar" :aria-label="locale.t('flow.addStep', 'Add step')">
              <ElButton data-testid="add-action" :disabled="!canEdit" @click="addAtRoot('action')"><Plus :size="14" />{{ locale.t('flow.step.action', 'Action') }}</ElButton>
              <ElButton data-testid="add-condition" :disabled="!canEdit" @click="addAtRoot('condition')"><GitBranch :size="14" />{{ locale.t('flow.step.condition', 'Condition') }}</ElButton>
              <ElButton data-testid="add-reaction" :disabled="!canEdit" @click="addAtRoot('reaction')"><Zap :size="14" />{{ locale.t('flow.step.reaction', 'Update form') }}</ElButton>
              <ElButton data-testid="add-terminate" :disabled="!canEdit" @click="addAtRoot('terminate')"><CircleStop :size="14" />{{ locale.t('flow.step.terminate', 'Finish') }}</ElButton>
            </div>
          </header>

          <div v-if="removed" class="flow-removed-state">
            <Trash2 :size="24" aria-hidden="true" />
            <strong>{{ locale.t('flow.removed.title', 'Flow marked for removal') }}</strong>
            <ElButton :disabled="readonly" @click="restoreRemovedFlow"><Undo2 :size="14" />{{ locale.t('flow.removed.undo', 'Keep flow') }}</ElButton>
          </div>

          <div v-else-if="!representable" class="flow-unrepresentable-state">
            <GitBranch :size="24" aria-hidden="true" />
            <strong>{{ locale.t('flow.unrepresentable.title', 'This imported graph cannot be edited as ordered steps') }}</strong>
          </div>

          <div v-else class="flow-step-tree" data-testid="step-tree">
            <div v-if="treeEntries.length === 0" class="flow-step-empty">
              {{ locale.t('flow.steps.empty', 'Add the first action, condition, update, or finish step.') }}
            </div>

            <template v-for="entry in treeEntries" :key="entry.entryType === 'step' ? entry.step.id : `${entry.conditionId}-${entry.branch}`">
              <div
                v-if="entry.entryType === 'branch'"
                class="flow-branch-row"
                :class="`is-${entry.branch}`"
                :style="depthStyle(entry.depth)"
              >
                <span>{{ entry.branch === 'then' ? locale.t('flow.branch.then', 'Then') : locale.t('flow.branch.else', 'Otherwise') }}</span>
                <span class="flow-branch-line" />
                <ElDropdown
                  trigger="click"
                  placement="bottom-end"
                  append-to="#workbench-overlays"
                  :disabled="!canEdit"
                  @command="addToBranch(entry, $event)"
                >
                  <ElButton text :disabled="!canEdit" :title="locale.t('flow.branch.add', 'Add step to branch')" :aria-label="locale.t('flow.branch.add', 'Add step to branch')">
                    <Plus :size="14" aria-hidden="true" />
                  </ElButton>
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem command="action"><Workflow :size="14" />{{ locale.t('flow.step.action', 'Action') }}</ElDropdownItem>
                      <ElDropdownItem command="condition"><GitBranch :size="14" />{{ locale.t('flow.step.condition', 'Condition') }}</ElDropdownItem>
                      <ElDropdownItem command="reaction"><Zap :size="14" />{{ locale.t('flow.step.reaction', 'Update form') }}</ElDropdownItem>
                      <ElDropdownItem command="terminate"><CircleStop :size="14" />{{ locale.t('flow.step.terminate', 'Finish') }}</ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </div>

              <article
                v-else
                class="flow-step-row"
                :class="[`is-${entry.step.type}`, { 'is-selected': selectedStepId === entry.step.id }]"
                :style="depthStyle(entry.depth)"
                :data-step-id="entry.step.id"
                tabindex="0"
                @click="selectedStepId = entry.step.id"
                @keydown.enter.prevent="selectedStepId = entry.step.id"
                @keydown.space.prevent="selectedStepId = entry.step.id"
              >
                <span class="flow-step-order">{{ entry.index + 1 }}</span>
                <component :is="stepIcon(entry.step)" :size="16" aria-hidden="true" />
                <div class="flow-step-label">
                  <span>{{ stepTypeLabel(entry.step) }}</span>
                  <strong>{{ stepTitle(entry.step) }}</strong>
                </div>
                <div class="flow-step-actions">
                  <ElButton text :disabled="!canEdit || !canMove(entry.step.id, -1)" :title="locale.t('flow.moveUp', 'Move up')" :aria-label="locale.t('flow.moveUp', 'Move up')" @click.stop="moveStep(entry.step.id, -1)"><ArrowUp :size="13" /></ElButton>
                  <ElButton text :disabled="!canEdit || !canMove(entry.step.id, 1)" :title="locale.t('flow.moveDown', 'Move down')" :aria-label="locale.t('flow.moveDown', 'Move down')" @click.stop="moveStep(entry.step.id, 1)"><ArrowDown :size="13" /></ElButton>
                  <ElButton text :disabled="!canEdit" :title="locale.t('flow.duplicateStep', 'Duplicate step')" :aria-label="locale.t('flow.duplicateStep', 'Duplicate step')" @click.stop="duplicateStep(entry.step.id)"><Copy :size="13" /></ElButton>
                  <ElButton text :disabled="!canEdit" :title="locale.t('flow.deleteStep', 'Delete step')" :aria-label="locale.t('flow.deleteStep', 'Delete step')" @click.stop="removeStep(entry.step.id)"><Trash2 :size="13" /></ElButton>
                </div>
              </article>
            </template>
          </div>
        </main>

        <aside class="flow-step-inspector" :aria-label="locale.t('flow.inspector', 'Step settings')">
          <template v-if="selectedStep && !removed">
            <header>
              <div>
                <span>{{ stepTypeLabel(selectedStep) }}</span>
                <strong>{{ stepTitle(selectedStep) }}</strong>
              </div>
            </header>

            <section class="flow-inspector-group">
              <label>
                <span>{{ locale.t('flow.step.title', 'Step label') }}</span>
                <ElInput :model-value="selectedStep.title ?? ''" :disabled="!canEdit" :aria-label="locale.t('flow.step.title', 'Step label')" @change="updateTitle" />
              </label>
            </section>

            <section v-if="selectedStep.type === 'action'" class="flow-inspector-group">
              <label>
                <span>{{ locale.t('flow.action.choose', 'Action') }}</span>
                <ElSelect :model-value="selectedStep.ref" :disabled="!canEdit" filterable append-to="#workbench-overlays" @change="changeActionDescriptor">
                  <ElOptionGroup v-for="group in descriptorGroups" :key="group.category" :label="categoryTitle(group.category)">
                    <ElOption v-for="descriptor in group.descriptors" :key="descriptor.ref" :value="descriptor.ref" :label="descriptorTitle(descriptor)" />
                  </ElOptionGroup>
                </ElSelect>
              </label>
              <ActionInputs
                v-if="selectedDescriptor"
                :model-value="selectedStep.input"
                :descriptor="selectedDescriptor"
                :disabled="!canEdit"
                :invalid-parameters="invalidParameters"
                :fields="fields"
                :event-arguments="eventArguments"
                :outputs="outputOptions"
                :variables="sourceCatalog?.variables"
                :data-sources="sourceCatalog?.dataSources"
                :locale="locale"
                @update:model-value="setStepInput"
              />
              <p v-else class="flow-inline-error" role="alert">{{ locale.t('flow.validation.actionUnavailable', 'Choose an available action.') }}</p>
            </section>

            <section v-else-if="selectedStep.type === 'condition'" class="flow-inspector-group">
              <ConditionEditor
                :model-value="selectedStep.when"
                :disabled="!canEdit"
                :fields="fields"
                :event-arguments="eventArguments"
                :outputs="outputOptions"
                :locale="locale"
                @update:model-value="updateCondition"
              />
            </section>

            <section v-else-if="selectedStep.type === 'reaction'" class="flow-inspector-group">
              <ReactionEditor
                :model-value="selectedStep.reactions"
                :disabled="!canEdit"
                :fields="fields"
                :event-arguments="eventArguments"
                :outputs="outputOptions"
                :locale="locale"
                @update:model-value="setStepReactions"
              />
            </section>

            <section v-else-if="selectedStep.type === 'terminate'" class="flow-inspector-group">
              <label>
                <span>{{ locale.t('flow.outcome', 'Flow outcome') }}</span>
                <ElSelect :model-value="selectedStep.outcome" :disabled="!canEdit" append-to="#workbench-overlays" @change="updateOutcome">
                  <ElOption value="end" :label="locale.t('flow.outcome.end', 'End')" />
                  <ElOption value="success" :label="locale.t('flow.outcome.success', 'Success')" />
                  <ElOption value="failure" :label="locale.t('flow.outcome.failure', 'Failure')" />
                  <ElOption value="blocked" :label="locale.t('flow.outcome.blocked', 'Blocked')" />
                </ElSelect>
              </label>
            </section>

            <section v-if="selectedStep.type === 'action' || selectedStep.type === 'reaction'" class="flow-inspector-group">
              <strong>{{ locale.t('flow.policy.title', 'Execution policy') }}</strong>
              <StepPolicyEditor
                :model-value="selectedStep.policy"
                :disabled="!canEdit"
                :fields="fields"
                :event-arguments="eventArguments"
                :outputs="outputOptions"
                :locale="locale"
                @update:model-value="updateStepPolicy"
              />
            </section>
          </template>
          <div v-else class="flow-inspector-empty">
            <Workflow :size="22" aria-hidden="true" />
            <span>{{ locale.t('flow.inspector.empty', 'Select a step to edit it.') }}</span>
          </div>
        </aside>
      </div>

      <footer class="flow-workspace-footer">
        <span class="flow-save-state">
          {{ saving ? locale.t('flow.saving', 'Saving...') : dirty ? locale.t('flow.unsavedChanges', 'Unsaved changes') : locale.t('flow.noChanges', 'No changes') }}
        </span>
        <ElButton data-testid="cancel-flow" :disabled="saving" @click="cancel">
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ElButton
          type="primary"
          data-testid="save-flow"
          :loading="saving"
          :disabled="saving || blocked || !dirty || (!representable && !removed)"
          @click="save"
        >
          <Save :size="14" aria-hidden="true" />
          {{ locale.t('flow.save', 'Save flow') }}
        </ElButton>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.flow-workspace { display: grid; width: 100%; height: 100%; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0, 1fr) auto; color: var(--wb-text); background: var(--wb-surface); }
.flow-diagnostics { max-height: 92px; overflow: auto; padding: 7px 12px; border-bottom: 1px solid color-mix(in srgb, var(--wb-danger) 56%, var(--wb-separator)); background: var(--wb-danger-soft); }
.flow-diagnostic.el-button { width: 100%; height: auto; min-height: 24px; margin: 0; padding: 3px 4px; justify-content: flex-start; color: var(--wb-danger); font-size: 11px; text-align: left; white-space: normal; }
.flow-diagnostic.el-button + .flow-diagnostic.el-button { margin-top: 3px; }
.flow-diagnostic :deep(> span) { display: flex; min-width: 0; align-items: baseline; flex-wrap: wrap; gap: 4px 7px; }
.flow-diagnostic-code { flex: 0 0 auto; font-weight: 700; }
.flow-diagnostic-path { color: inherit; font-size: 10px; overflow-wrap: anywhere; }
.flow-diagnostic-message { min-width: 0; overflow-wrap: anywhere; }
.flow-empty, .flow-removed-state, .flow-unrepresentable-state { display: grid; min-height: 220px; place-content: center; justify-items: center; gap: 10px; padding: 24px; text-align: center; }
.flow-empty > svg, .flow-removed-state > svg, .flow-unrepresentable-state > svg { color: var(--wb-muted); }
.flow-empty > span { color: var(--wb-muted); font-size: 11px; }
.flow-workspace-body { display: grid; min-width: 0; min-height: 0; grid-template-columns: 220px minmax(360px, 1fr) 360px; }
.flow-event-settings, .flow-step-inspector { min-width: 0; min-height: 0; overflow: auto; background: var(--wb-surface); }
.flow-event-settings { display: flex; padding: 12px; flex-direction: column; gap: 13px; border-right: 1px solid var(--wb-separator); }
.flow-event-settings > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.flow-event-settings > header strong { font-size: 12px; }
.flow-dirty-state { color: var(--wb-accent); font-size: 10px; }
.flow-event-settings > label, .flow-inspector-group > label { display: grid; min-width: 0; gap: 5px; }
.flow-event-settings > label > span, .flow-inspector-group > label > span, .flow-locked-trigger > span { color: var(--wb-muted); font-size: 10px; }
.flow-event-settings :deep(.el-select), .flow-event-settings :deep(.el-input-number), .flow-step-inspector :deep(.el-select), .flow-step-inspector :deep(.el-input-number) { width: 100%; }
.flow-locked-trigger { display: grid; gap: 4px; }
.flow-locked-trigger strong { font-size: 11px; line-height: 1.45; overflow-wrap: anywhere; }
.flow-danger-button { margin-top: auto; color: var(--wb-danger); border-color: color-mix(in srgb, var(--wb-danger) 55%, var(--wb-control-border)); }
.flow-step-workspace { display: grid; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0, 1fr); background: var(--wb-bg); }
.flow-step-toolbar { display: flex; min-width: 0; padding: 9px 12px; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--wb-separator); background: var(--wb-surface); }
.flow-step-toolbar > div:first-child { display: grid; min-width: 0; }
.flow-step-toolbar strong { font-size: 12px; }
.flow-step-toolbar span { color: var(--wb-muted); font-size: 10px; }
.flow-add-actions { display: flex; min-width: 0; overflow-x: auto; gap: 5px; }
.flow-add-actions .el-button { flex: 0 0 auto; margin: 0; padding: 0 8px; font-size: 11px; }
.flow-step-tree { min-width: 0; min-height: 0; overflow: auto; padding: 14px; }
.flow-step-empty { display: grid; min-height: 140px; place-content: center; color: var(--wb-muted); font-size: 11px; text-align: center; }
.flow-step-row, .flow-branch-row { margin-left: min(calc(var(--flow-depth) * 18px), 45%); }
.flow-step-row { position: relative; display: grid; min-width: 250px; min-height: 52px; grid-template-columns: 24px 22px minmax(0, 1fr) auto; padding: 7px 8px; align-items: center; gap: 7px; border: 1px solid var(--wb-control-border); border-left: 3px solid var(--wb-accent); border-radius: 6px; background: var(--wb-elevated); cursor: pointer; }
.flow-step-row + .flow-step-row, .flow-branch-row + .flow-step-row { margin-top: 7px; }
.flow-step-row.is-condition { border-left-color: #c58c20; }
.flow-step-row.is-reaction { border-left-color: #3b8d72; }
.flow-step-row.is-terminate { border-left-color: var(--wb-muted); }
.flow-step-row.is-selected { border-color: var(--wb-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--wb-accent) 20%, transparent); }
.flow-step-order { color: var(--wb-muted); font-size: 10px; text-align: center; }
.flow-step-label { display: grid; min-width: 0; gap: 1px; }
.flow-step-label span { color: var(--wb-muted); font-size: 10px; text-transform: uppercase; }
.flow-step-label strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.flow-step-actions { display: flex; opacity: .7; }
.flow-step-row:hover .flow-step-actions, .flow-step-row.is-selected .flow-step-actions, .flow-step-actions:focus-within { opacity: 1; }
.flow-step-actions .el-button { width: 25px; min-height: 25px; margin: 0; padding: 0; }
.flow-branch-row { display: flex; min-width: 220px; height: 34px; align-items: center; gap: 7px; color: #328362; }
.flow-branch-row.is-else { color: #a16c20; }
.flow-branch-row > span:first-child { flex: 0 0 auto; font-size: 10px; font-weight: 650; text-transform: uppercase; }
.flow-branch-line { height: 1px; flex: 1 1 auto; background: currentColor; opacity: .35; }
.flow-branch-row .el-button { width: 26px; min-height: 26px; padding: 0; color: currentColor; }
.flow-step-inspector { border-left: 1px solid var(--wb-separator); }
.flow-step-inspector > header { padding: 11px 12px; border-bottom: 1px solid var(--wb-separator); }
.flow-step-inspector > header > div { display: grid; gap: 2px; }
.flow-step-inspector > header span { color: var(--wb-muted); font-size: 10px; text-transform: uppercase; }
.flow-step-inspector > header strong { font-size: 12px; overflow-wrap: anywhere; }
.flow-inspector-group { display: grid; min-width: 0; padding: 12px; gap: 10px; border-bottom: 1px solid var(--wb-separator); }
.flow-inspector-group > strong { font-size: 11px; }
.flow-inspector-empty { display: grid; min-height: 180px; place-content: center; justify-items: center; gap: 8px; padding: 20px; color: var(--wb-muted); font-size: 11px; text-align: center; }
.flow-inline-error { margin: 0; color: var(--wb-danger); font-size: 11px; }
.flow-workspace-footer { display: flex; min-height: 52px; padding: 9px 12px; align-items: center; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--wb-separator); background: var(--wb-elevated); }
.flow-save-state { margin-right: auto; color: var(--wb-muted); font-size: 10px; }

@media (max-width: 1050px) {
  .flow-workspace-body { grid-template-columns: 210px minmax(320px, 1fr); overflow: auto; }
  .flow-step-inspector { grid-column: 1 / -1; min-height: 260px; max-height: 360px; border-top: 1px solid var(--wb-separator); border-left: 0; }
}

@media (max-width: 680px) {
  .flow-workspace-body { display: block; overflow: auto; }
  .flow-event-settings, .flow-step-workspace, .flow-step-inspector { min-height: 260px; overflow: visible; border: 0; border-bottom: 1px solid var(--wb-separator); }
  .flow-step-toolbar { align-items: flex-start; flex-direction: column; }
  .flow-add-actions { width: 100%; }
  .flow-step-tree { overflow: visible; }
  .flow-step-actions { opacity: 1; }
  .flow-workspace-footer { position: sticky; z-index: 2; bottom: 0; }
}
</style>
