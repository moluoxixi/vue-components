<script setup lang="ts">
import type {
  ConfigFormFlowStepPolicy,
  ConfigFormReactionCondition,
} from '@moluoxixi/config-form-core'
import type { StepPolicyEditorEmits, StepPolicyEditorProps } from './types'
import { computed } from 'vue'
import { ConditionEditor } from '../ConditionEditor'

const props = withDefaults(defineProps<StepPolicyEditorProps>(), { disabled: false })
const emit = defineEmits<StepPolicyEditorEmits>()
const hasWhen = computed(() => props.modelValue?.when !== undefined)
const hasStopWhen = computed(() => props.modelValue?.stopWhen !== undefined)
const hasTimeout = computed(() => props.modelValue?.timeoutMs !== undefined)

function update(patch: Partial<ConfigFormFlowStepPolicy>, remove: Array<keyof ConfigFormFlowStepPolicy> = []): void {
  if (props.disabled)
    return
  const next = { ...(props.modelValue ?? {}), ...patch }
  remove.forEach(key => delete next[key])
  emit('update:modelValue', Object.keys(next).length > 0 ? next : undefined)
}

function toggleCondition(key: 'when' | 'stopWhen', enabled: boolean): void {
  if (enabled)
    update({ [key]: { kind: 'literal', value: true } })
  else
    update({}, [key])
}

function setCondition(key: 'when' | 'stopWhen', condition: ConfigFormReactionCondition): void {
  update({ [key]: condition })
}

function setOnError(value: 'inherit' | 'continue' | 'failure'): void {
  if (value === 'inherit')
    update({}, ['onError'])
  else
    update({ onError: value })
}

function toggleTimeout(enabled: boolean): void {
  if (enabled)
    update({ timeoutMs: 10000 })
  else
    update({}, ['timeoutMs'])
}

function setTimeoutValue(value: number | undefined): void {
  const timeoutMs = Number(value)
  if (Number.isInteger(timeoutMs) && timeoutMs >= 0)
    update({ timeoutMs })
}
</script>

<template>
  <div class="flow-step-policy">
    <label class="flow-policy-toggle">
      <ElCheckbox :model-value="hasWhen" :disabled="disabled" @change="toggleCondition('when', Boolean($event))" />
      <span>{{ locale.t('flow.policy.when', 'Run only when') }}</span>
    </label>
    <ConditionEditor
      v-if="modelValue?.when"
      :model-value="modelValue.when"
      :disabled="disabled"
      :fields="fields"
      :event-arguments="eventArguments"
      :outputs="outputs"
      :locale="locale"
      @update:model-value="setCondition('when', $event)"
    />

    <label class="flow-policy-toggle">
      <ElCheckbox :model-value="hasStopWhen" :disabled="disabled" @change="toggleCondition('stopWhen', Boolean($event))" />
      <span>{{ locale.t('flow.policy.stopWhen', 'Block the flow after this step when') }}</span>
    </label>
    <ConditionEditor
      v-if="modelValue?.stopWhen"
      :model-value="modelValue.stopWhen"
      :disabled="disabled"
      :fields="fields"
      :event-arguments="eventArguments"
      :outputs="outputs"
      :locale="locale"
      @update:model-value="setCondition('stopWhen', $event)"
    />

    <label>
      <span>{{ locale.t('flow.policy.onError', 'If this step fails') }}</span>
      <ElSelect :model-value="modelValue?.onError ?? 'inherit'" :disabled="disabled" append-to="#workbench-overlays" @change="setOnError">
        <ElOption value="inherit" :label="locale.t('flow.policy.inherit', 'Use flow setting')" />
        <ElOption value="continue" :label="locale.t('flow.policy.continue', 'Continue to the next step')" />
        <ElOption value="failure" :label="locale.t('flow.policy.failure', 'Stop as failure')" />
      </ElSelect>
    </label>

    <label class="flow-policy-toggle">
      <ElCheckbox :model-value="hasTimeout" :disabled="disabled" @change="toggleTimeout(Boolean($event))" />
      <span>{{ locale.t('flow.policy.customTimeout', 'Custom timeout') }}</span>
    </label>
    <label v-if="hasTimeout">
      <span>{{ locale.t('flow.timeout', 'Timeout (ms)') }}</span>
      <ElInputNumber :model-value="modelValue?.timeoutMs ?? 10000" :disabled="disabled" :min="0" :step="100" controls-position="right" @change="setTimeoutValue" />
    </label>
  </div>
</template>

<style scoped>
.flow-step-policy { display: grid; min-width: 0; gap: 9px; }
.flow-step-policy > label:not(.flow-policy-toggle) { display: grid; gap: 5px; }
.flow-step-policy > label > span { color: var(--wb-muted); font-size: 10px; }
.flow-policy-toggle { display: flex; min-width: 0; align-items: center; gap: 7px; }
.flow-policy-toggle .el-checkbox { margin: 0; }
</style>
