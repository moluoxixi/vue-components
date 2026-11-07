<script setup lang="ts">
import type { HTMLAttributes, StyleValue } from 'vue'

defineOptions({
  name: 'ConfigFormItem',
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    label?: string
    required?: boolean
    errors?: readonly string[]
    controlId?: string
    errorId?: string
    helpId?: string
    description?: string
    help?: string
    warning?: string
    loading?: boolean
    validating?: boolean
    loadingText?: string
    validatingText?: string
    supportingStyle?: StyleValue
    labelClass?: HTMLAttributes['class']
    controlClass?: HTMLAttributes['class']
    errorClass?: HTMLAttributes['class']
    controlStyle?: StyleValue
    errorStyle?: StyleValue
  }>(),
  {
    errors: () => [],
  },
)
</script>

<template>
  <div v-bind="$attrs" data-config-form-item>
    <label
      v-if="props.label"
      :class="props.labelClass"
      data-config-form-label
      :data-required="props.required || undefined"
      :for="props.controlId"
    >
      {{ props.label }}
    </label>
    <div :class="props.controlClass" data-config-form-control :style="props.controlStyle">
      <slot />
    </div>
    <div
      v-if="props.description || props.help || props.warning || props.loading || props.validating || $slots.help"
      :id="props.helpId"
      data-config-form-supporting
      :style="props.supportingStyle"
    >
      <p v-if="props.description" data-config-form-description>
        {{ props.description }}
      </p>
      <slot name="help">
        <p v-if="props.help" data-config-form-help>
          {{ props.help }}
        </p>
      </slot>
      <p v-if="props.warning" data-config-form-warning>
        {{ props.warning }}
      </p>
      <span v-if="props.loading || props.validating" role="status" data-config-form-status>
        <slot name="status" :loading="props.loading" :validating="props.validating">{{
          props.loading ? (props.loadingText ?? 'Loading…') : (props.validatingText ?? 'Validating…')
        }}</slot>
      </span>
    </div>
    <p
      v-for="(message, index) in props.errors"
      :id="index === 0 ? props.errorId : undefined"
      :key="`${message}-${index}`"
      :class="props.errorClass"
      data-config-form-error
      role="alert"
      :style="props.errorStyle"
    >
      {{ message }}
    </p>
  </div>
</template>
