<script setup lang="ts">
import A from './a/index.vue'
import B from './b/index.vue'

defineProps<{ own?: boolean }>()
</script>

<template>
  <div>
    <A v-bind="$attrs" />
    <B />
  </div>
</template>
