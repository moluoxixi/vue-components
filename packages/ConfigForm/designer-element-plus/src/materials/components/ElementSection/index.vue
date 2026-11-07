<script setup lang="ts">
import type { ElementSectionProps } from '../../../types'

const props = defineProps<ElementSectionProps>()
</script>

<template>
  <section class="mx-element-designer-section">
    <header v-if="props.title || props.description">
      <h3 v-if="props.title">
        {{ props.title }}
      </h3>
      <p v-if="props.description">
        {{ props.description }}
      </p>
    </header>
    <slot />
  </section>
</template>
