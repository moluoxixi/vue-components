<script setup lang="ts">
import type { RequestOptionRecord, RequestParamsRecord } from '../../request/types'

const props = defineProps<{
  query: (params: RequestParamsRecord) => Promise<RequestOptionRecord[]>
}>()
</script>

<template>
  <div />
</template>
