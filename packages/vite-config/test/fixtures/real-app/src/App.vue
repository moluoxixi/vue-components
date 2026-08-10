<script setup lang="ts">
import { createGreeting } from '@/composables/useGreeting'

const count = ref(1)
const doubled = computed(() => count.value * 2)
const greeting = createGreeting('production-ready fixture')
</script>

<template>
  <main class="shell">
    <h1>{{ greeting }}</h1>
    <RealCounter :count="count" :doubled="doubled" @increment="count += 1" />
  </main>
</template>
