<script setup lang="ts">
import SubComp from './sub/index.vue'

defineProps<{ placeholder?: string }>()
</script>

<template>
  <sub-comp v-bind="$attrs" />
</template>
