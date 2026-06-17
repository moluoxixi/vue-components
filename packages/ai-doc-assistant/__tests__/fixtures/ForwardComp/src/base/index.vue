<script setup lang="ts">
import type { BaseProps } from '../types/baseProps'

defineProps<BaseProps>()
defineEmits<{ (e: 'select', row: string): void }>()
</script>

<template>
  <table />
</template>
