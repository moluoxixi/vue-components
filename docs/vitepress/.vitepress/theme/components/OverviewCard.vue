<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowRight } from '@lucide/vue'

export interface CardItem {
  name: string
  desc: string
  link: string
  icon: Component
}

defineProps<{
  items: CardItem[]
}>()
</script>

<template>
  <div class="overview-grid">
    <a
      v-for="item in items"
      :key="item.name"
      :href="item.link"
      class="overview-card"
    >
      <span class="overview-card-icon" aria-hidden="true">
        <component :is="item.icon" :size="20" :stroke-width="1.8" />
      </span>
      <span class="overview-card-copy">
        <strong>{{ item.name }}</strong>
        <span>{{ item.desc }}</span>
      </span>
      <ArrowRight class="overview-card-arrow" :size="17" aria-hidden="true" />
    </a>
  </div>
</template>
