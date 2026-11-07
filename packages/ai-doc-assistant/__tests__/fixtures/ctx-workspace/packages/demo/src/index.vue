<script setup lang="ts">
const props = defineProps<{ label: string, disabled?: boolean }>()
defineEmits<{ click: [id: number] }>()
</script>

<template>
  <button>{{ props.label }}</button>
</template>
