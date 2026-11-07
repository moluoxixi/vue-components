<script setup lang="ts">
import Base from './base/index.vue'

const props = defineProps<{ placeholder?: string }>()
</script>

<template>
  <Base v-bind="$attrs" />
</template>
