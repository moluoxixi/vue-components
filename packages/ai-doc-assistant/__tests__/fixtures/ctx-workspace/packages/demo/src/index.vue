<script setup lang="ts">
defineProps<{ label: string, disabled?: boolean }>()
defineEmits<{ click: [id: number] }>()
</script>

<template>
  <button>{{ label }}</button>
</template>
