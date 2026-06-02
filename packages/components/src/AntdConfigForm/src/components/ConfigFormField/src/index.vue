<script setup lang="ts" generic="TValues extends ConfigFormValues = ConfigFormValues">
import type {
  ConfigFormFieldChangeRequest,
  ConfigFormValues,
} from '../../../../../ConfigForm'
import type { ConfigFormFieldEmits, ConfigFormFieldProps } from './types'
import { FormItem as AFormItem } from 'ant-design-vue'
import { useSlots } from 'vue'
import FormComponent from '../../FormComponent'
import { resolveConfigFormCondition } from '../../../../../ConfigForm'

defineOptions({
  name: 'AntdConfigFormField',
})

const props = defineProps<ConfigFormFieldProps<TValues>>()
const emit = defineEmits<ConfigFormFieldEmits<TValues>>()
const slots = useSlots()

function handleFieldChange(payload: ConfigFormFieldChangeRequest<TValues>): void {
  emit('fieldChange', payload)
}

function getForwardedSlotNames(): string[] {
  return Object.keys(slots)
}

function isFieldRequired(): boolean {
  return resolveConfigFormCondition(props.field.required, props.model, false)
}
</script>

<template>
  <AFormItem
    v-bind="field.formItemProps"
    :label="field.label"
    :name="field.field"
    :required="isFieldRequired()"
    :rules="field.rules"
  >
    <div class="mx-antd-config-form__control">
      <FormComponent
        :field="field"
        :model="model"
        @field-change="handleFieldChange"
      >
        <template
          v-for="slotName in getForwardedSlotNames()"
          #[slotName]="slotProps"
        >
          <slot
            :name="slotName"
            v-bind="slotProps ?? {}"
          />
        </template>
      </FormComponent>
    </div>
  </AFormItem>
</template>
