<script setup lang="ts">
import SubComp from './sub/index.vue'

const props = defineProps<{ placeholder?: string }>()
</script>

<template>
  <SubComp v-bind="$attrs" />
</template>
