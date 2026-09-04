<script setup lang="ts">
import type { RequestCascaderEmits, RequestCascaderExpose, RequestCascaderModelValue, RequestCascaderProps } from '../../types'
import { ElCascader } from 'element-plus'
import { useAttrs } from 'vue'
import { useRequestOptionsComponent } from '../../../request/composables'

defineOptions({
  name: 'RequestCascader',
})

const props = withDefaults(defineProps<RequestCascaderProps>(), {
  params: () => ({}),
  enabled: true,
})
const emit = defineEmits<RequestCascaderEmits>()
const modelValue = defineModel<RequestCascaderModelValue>()
const attrs = useAttrs()

const { loading, options, refetch } = useRequestOptionsComponent(props, emit, 'RequestCascader')

defineExpose<RequestCascaderExpose>({
  refetch,
})
</script>

<template>
  <ElCascader
    v-bind="attrs"
    v-model="modelValue"
    :options="options"
    :loading="loading"
  />
</template>
