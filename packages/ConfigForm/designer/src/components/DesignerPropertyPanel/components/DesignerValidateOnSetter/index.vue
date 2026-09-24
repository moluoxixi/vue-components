<script setup lang="ts">
import type { ValidateTrigger } from '@moluoxixi/config-form-model'
import { ElCheckbox, ElCheckboxGroup } from 'element-plus'
import { computed } from 'vue'
import { useDesignerLocale } from '@designer/locale'

const props = defineProps<{
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ValidateTrigger | ValidateTrigger[] | undefined]
}>()

const locale = useDesignerLocale()
const triggerOrder: ValidateTrigger[] = ['change', 'blur', 'submit']
const selected = computed(() => {
  const values = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
  const valid = new Set(values.filter((value): value is ValidateTrigger => triggerOrder.includes(value as ValidateTrigger)))
  return valid.size > 0 ? triggerOrder.filter(value => valid.has(value)) : ['submit']
})

function commit(values: Array<string | number>): void {
  const selectedValues = triggerOrder.filter(value => values.includes(value))
  if (selectedValues.length === 0)
    return
  if (selectedValues.length === 1 && selectedValues[0] === 'submit') {
    emit('update:modelValue', undefined)
    return
  }
  emit('update:modelValue', selectedValues.length === 1 ? selectedValues[0] : selectedValues)
}
</script>

<template>
  <ElCheckboxGroup class="mx-config-form-designer__validate-on" :model-value="selected" :disabled="disabled" @update:model-value="commit">
    <ElCheckbox value="change">{{ locale.t('validation.trigger.change', 'Change') }}</ElCheckbox>
    <ElCheckbox value="blur">{{ locale.t('validation.trigger.blur', 'Blur') }}</ElCheckbox>
    <ElCheckbox value="submit">{{ locale.t('validation.trigger.submit', 'Submit') }}</ElCheckbox>
  </ElCheckboxGroup>
</template>
