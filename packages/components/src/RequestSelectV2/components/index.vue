<script setup lang="ts">
import type { RequestSelectV2Emits, RequestSelectV2Expose, RequestSelectV2ModelValue, RequestSelectV2Props } from '../types'
import { ElSelectV2 } from 'element-plus'
import { useAttrs } from 'vue'
import { useRequestOptionsComponent } from '#components/request/composables'

defineOptions({
  name: 'RequestSelectV2',
})

const props = withDefaults(defineProps<RequestSelectV2Props>(), {
  params: () => ({}),
  enabled: true,
})
const emit = defineEmits<RequestSelectV2Emits>()
const modelValue = defineModel<RequestSelectV2ModelValue>()
const attrs = useAttrs()

const { loading, options, refetch } = useRequestOptionsComponent(props, emit, 'RequestSelectV2')

defineExpose<RequestSelectV2Expose>({
  refetch,
})
</script>

<template>
  <ElSelectV2
    v-bind="attrs"
    v-model="modelValue"
    :options="options"
    :loading="loading"
  />
</template>
