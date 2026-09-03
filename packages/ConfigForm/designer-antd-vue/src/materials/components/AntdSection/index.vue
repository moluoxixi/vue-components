<script setup lang="ts">
import type { AntdSectionProps } from '../../../types'

defineProps<AntdSectionProps>()
</script>

<template>
  <section class="mx-antd-designer-section">
    <header v-if="title || description">
      <h3 v-if="title">{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </header>
    <slot />
  </section>
</template>
