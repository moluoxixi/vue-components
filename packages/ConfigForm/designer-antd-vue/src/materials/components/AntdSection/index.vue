<script setup lang="ts">
import type { AntdSectionProps } from '../../../types'

const props = defineProps<AntdSectionProps>()
</script>

<template>
  <section class="mx-antd-designer-section">
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
