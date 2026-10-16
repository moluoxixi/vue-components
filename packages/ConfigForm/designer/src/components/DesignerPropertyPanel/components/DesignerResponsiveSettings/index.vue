<script setup lang="ts">
import type { ConfigFormResponsiveLayout } from '@moluoxixi/config-form-core'
import type { FormSettings } from '@moluoxixi/config-form-model'
import type { DesignerResponsiveSettingsProps } from '../../types/responsive-settings'
import { useDesignerResponsiveSettings } from '../../composables/use-designer-responsive-settings'
import DesignerPropertyForm from '../DesignerPropertyForm/index.vue'

const props = withDefaults(defineProps<DesignerResponsiveSettingsProps>(), {
  showHeading: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: ConfigFormResponsiveLayout | undefined]
  'updateForm': [value: Partial<FormSettings>]
  commit: [value: ConfigFormResponsiveLayout | undefined]
}>()

const { entries, layout } = useDesignerResponsiveSettings(props, {
  onUpdateForm: value => emit('updateForm', value),
  onCommitResponsive: (value) => {
    emit('update:modelValue', value)
    emit('commit', value)
  },
})
</script>

<template>
  <DesignerPropertyForm
    :entries="entries"
    :layout="layout"
    :components="components"
    :controls="controls"
    :readonly="disabled || readonly"
    :renderer="renderer"
  />
</template>
