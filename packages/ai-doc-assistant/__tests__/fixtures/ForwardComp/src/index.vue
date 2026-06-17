<script setup lang="ts">
import Base from './base/index.vue'

defineProps<{ placeholder?: string }>()
</script>

<template>
  <Base v-bind="$attrs" />
</template>
