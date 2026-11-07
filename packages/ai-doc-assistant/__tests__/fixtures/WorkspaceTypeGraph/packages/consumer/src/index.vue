<script setup lang="ts">
import type { CycleA, SharedWorkspaceType } from '@fixture/contracts'
import type { MissingWorkspaceType } from '@fixture/not-installed'
import type { ComponentPublicInstance } from 'vue'

interface Props {
  external?: ComponentPublicInstance
  missing?: MissingWorkspaceType
  shared: SharedWorkspaceType
}

const props = defineProps<Props>()
defineEmits<{
  change: [payload: SharedWorkspaceType]
}>()
defineSlots<{
  default: (props: { item: SharedWorkspaceType }) => unknown
}>()

function inspect(value: SharedWorkspaceType): CycleA {
  return value.cycle
}

defineExpose({ inspect })
</script>

<template>
  <slot :item="props.shared" />
</template>
