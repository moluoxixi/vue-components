<script setup lang="ts">
import type { ConfigFormValueInput } from '@moluoxixi/config-form-core'
import type { ActionInputsEmits, ActionInputsProps } from './types'
import { computed } from 'vue'
import { ValueEditor } from '../ValueEditor'

const props = withDefaults(defineProps<ActionInputsProps>(), {
  dataSources: () => [],
  disabled: false,
  invalidParameters: () => [],
  variables: () => [],
})
const emit = defineEmits<ActionInputsEmits>()
const input = computed<Record<string, ConfigFormValueInput>>(() => isRecord(props.modelValue) ? props.modelValue : {})
const invalidParameterSet = computed(() => new Set(props.invalidParameters))

function update(name: string, value: ConfigFormValueInput): void {
  if (!props.disabled)
    emit('update:modelValue', { ...input.value, [name]: value })
}

function parameterTitle(name: string, fallback: string): string {
  return props.locale.t(`flow.actionParameter.${props.descriptor.ref}.${name}`, fallback)
}

function allowsReferences(control: string): boolean {
  return control !== 'field' && control !== 'variable' && control !== 'dataSource'
}

function isRecord(value: unknown): value is Record<string, ConfigFormValueInput> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
</script>

<template>
  <div class="flow-action-inputs" data-testid="flow-action-inputs">
    <div
      v-for="parameter in descriptor.parameters"
      :key="parameter.name"
      class="flow-parameter-row"
      :class="{ 'is-invalid': invalidParameterSet.has(parameter.name) }"
      :data-parameter="parameter.name"
      :aria-invalid="invalidParameterSet.has(parameter.name) || undefined"
      :tabindex="invalidParameterSet.has(parameter.name) ? -1 : undefined"
    >
      <label>
        <span>
          {{ parameterTitle(parameter.name, parameter.title) }}
          <sup v-if="parameter.required" :title="locale.t('flow.required', 'Required')">*</sup>
        </span>
        <ValueEditor
          :model-value="input[parameter.name]"
          :control="parameter.control"
          :options="parameter.options"
          :allow-references="allowsReferences(parameter.control)"
          :disabled="disabled"
          :invalid="invalidParameterSet.has(parameter.name)"
          :required="parameter.required"
          :fields="fields"
          :event-arguments="eventArguments"
          :outputs="outputs"
          :variables="variables"
          :data-sources="dataSources"
          :locale="locale"
          @update:model-value="update(parameter.name, $event)"
        />
      </label>
    </div>
    <p v-if="descriptor.parameters.length === 0" class="flow-parameter-empty">
      {{ locale.t('flow.input.none', 'This action has no parameters.') }}
    </p>
  </div>
</template>

<style scoped>
.flow-action-inputs { display: grid; min-width: 0; gap: 12px; }
.flow-parameter-row { min-width: 0; }
.flow-parameter-row.is-invalid { padding-left: 8px; border-left: 2px solid var(--wb-danger); }
.flow-parameter-row label { display: grid; min-width: 0; gap: 5px; }
.flow-parameter-row label > span { color: var(--wb-muted); font-size: 11px; }
.flow-parameter-row sup { margin-left: 2px; color: var(--wb-danger); }
.flow-parameter-empty { margin: 0; color: var(--wb-muted); font-size: 11px; }
</style>
