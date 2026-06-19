<script setup lang="ts">
import type { RequestOptionsComponentEmits, RequestOptionsComponentProps, RequestOptionRecord, RequestParamsRecord } from '../../request/types'
import { useRequestOptions } from '@moluoxixi/hooks'
import { computed, useAttrs, watch } from 'vue'

defineOptions({
  name: 'RequestSelectV2',
})

const props = withDefaults(defineProps<RequestOptionsComponentProps>(), {
  params: () => ({}),
  enabled: true,
})
const emit = defineEmits<RequestOptionsComponentEmits>()
const modelValue = defineModel<unknown>()
const attrs = useAttrs()

const request = useRequestOptions<RequestOptionRecord, RequestParamsRecord>({
  queryKey: props.cacheKey ?? 'RequestSelectV2',
  query: props.query,
  params: computed(() => props.params),
  enabled: computed(() => props.enabled),
  staleTime: props.staleTime,
})

const loading = computed(() => request.isLoading.value || request.isFetching.value)

watch(
  () => request.query.data.value,
  (options) => {
    if (options)
      emit('loaded', options)
  },
)

watch(
  () => request.error.value,
  (error) => {
    if (error)
      emit('error', error)
  },
)

defineExpose({
  refetch: request.refetch,
})
</script>

<template>
  <ElSelectV2
    v-bind="attrs"
    v-model="modelValue"
    :options="request.options.value"
    :loading="loading"
  />
</template>
