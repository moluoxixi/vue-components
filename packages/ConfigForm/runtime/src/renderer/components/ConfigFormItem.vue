<script setup lang="ts">
import type { HTMLAttributes, StyleValue } from 'vue'

defineOptions({
  name: 'ConfigFormItem',
  inheritAttrs: false,
})

withDefaults(
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
      v-if="label"
      :class="labelClass"
      data-config-form-label
      :data-required="required || undefined"
      :for="controlId"
    >
      {{ label }}
    </label>
    <div :class="controlClass" data-config-form-control :style="controlStyle">
      <slot />
    </div>
    <div
      v-if="description || help || warning || loading || validating || $slots.help"
      :id="helpId"
      data-config-form-supporting
      :style="supportingStyle"
    >
      <p v-if="description" data-config-form-description>
        {{ description }}
      </p>
      <slot name="help">
        <p v-if="help" data-config-form-help>
          {{ help }}
        </p>
      </slot>
      <p v-if="warning" data-config-form-warning>
        {{ warning }}
      </p>
      <span v-if="loading || validating" role="status" data-config-form-status>
        <slot name="status" :loading="loading" :validating="validating">{{
          loading ? (loadingText ?? 'Loading…') : (validatingText ?? 'Validating…')
        }}</slot>
      </span>
    </div>
    <p
      v-for="(message, index) in errors"
      :id="index === 0 ? errorId : undefined"
      :key="`${message}-${index}`"
      :class="errorClass"
      data-config-form-error
      role="alert"
      :style="errorStyle"
    >
      {{ message }}
    </p>
  </div>
</template>
