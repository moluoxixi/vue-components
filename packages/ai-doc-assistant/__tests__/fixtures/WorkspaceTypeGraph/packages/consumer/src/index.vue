<script setup lang="ts">
import type { MissingWorkspaceType } from '@fixture/not-installed'
import type { CycleA, SharedWorkspaceType } from '@fixture/contracts'
import type { ComponentPublicInstance } from 'vue'

interface Props {
  external?: ComponentPublicInstance
  missing?: MissingWorkspaceType
  shared: SharedWorkspaceType
}

defineProps<Props>()
defineEmits<{
  change: [payload: SharedWorkspaceType]
}>()
defineSlots<{
  default(props: { item: SharedWorkspaceType }): unknown
}>()

function inspect(value: SharedWorkspaceType): CycleA {
  return value.cycle
}

defineExpose({ inspect })
</script>

<template>
  <slot :item="shared" />
</template>
