<script setup lang="ts">
import type { HTMLAttributes, StyleValue } from 'vue'

defineOptions({
  inheritAttrs: false,
  name: 'ConfigFormItem',
})

withDefaults(defineProps<{
  label?: string
  required?: boolean
  errors?: readonly string[]
  controlId?: string
  errorId?: string
  labelClass?: HTMLAttributes['class']
  controlClass?: HTMLAttributes['class']
  errorClass?: HTMLAttributes['class']
  controlStyle?: StyleValue
  errorStyle?: StyleValue
}>(), {
  errors: () => [],
})
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
    <div
      :class="controlClass"
      data-config-form-control
      :style="controlStyle"
    >
      <slot />
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
