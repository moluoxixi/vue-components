<script setup lang="ts">
import type { RequestTreeSelectEmits, RequestTreeSelectExpose, RequestTreeSelectModelValue, RequestTreeSelectProps } from '../../types'
import { ElTreeSelect } from 'element-plus'
import { useAttrs } from 'vue'
import { useRequestOptionsComponent } from '../../../request/composables'

defineOptions({
  name: 'RequestTreeSelect',
})

const props = withDefaults(defineProps<RequestTreeSelectProps>(), {
  params: () => ({}),
  enabled: true,
})
const emit = defineEmits<RequestTreeSelectEmits>()
const modelValue = defineModel<RequestTreeSelectModelValue>()
const attrs = useAttrs()

const { loading, options, refetch } = useRequestOptionsComponent(props, emit, 'RequestTreeSelect')

defineExpose<RequestTreeSelectExpose>({
  refetch,
})
</script>

<template>
  <ElTreeSelect
    v-bind="attrs"
    v-model="modelValue"
    :data="options"
    :loading="loading"
  />
</template>
