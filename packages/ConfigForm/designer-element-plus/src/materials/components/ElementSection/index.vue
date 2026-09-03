<script setup lang="ts">
import type { ElementSectionProps } from '../../../types'

defineProps<ElementSectionProps>()
</script>

<template>
  <section class="mx-element-designer-section">
    <header v-if="title || description">
      <h3 v-if="title">{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </header>
    <slot />
  </section>
</template>
