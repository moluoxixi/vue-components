<script setup lang="ts">
interface SubProps {
  /** 列配置 */
  columns: string[]
}
const props = defineProps<SubProps>()
</script>

<template>
  <table />
</template>
