<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { ElementPlusDocsOverviewCardItem } from './types'

defineProps<{
  items: ElementPlusDocsOverviewCardItem[]
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

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.overview-card {
  display: grid;
  min-height: 80px;
  grid-template-columns: 38px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border: 1px solid var(--mx-border, var(--border-color));
  border-radius: 6px;
  background: var(--bg-color);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.16s, box-shadow 0.16s, background-color 0.16s;
}

.overview-card:hover,
.overview-card:focus-visible {
  border-color: var(--brand-color);
  background: var(--mx-fill-light, var(--bg-color-soft));
  box-shadow: 0 2px 8px rgba(31, 35, 41, 0.06);
  color: inherit;
  text-decoration: none;
  outline: none;
}

.overview-card-icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--mx-hover, var(--el-color-primary-light-9));
  color: var(--brand-color);
}

.overview-card-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.overview-card-copy strong {
  overflow-wrap: anywhere;
  color: var(--text-color);
  font-family: var(--font-family-mono);
  font-size: 13px;
  font-weight: 600;
}

.overview-card-copy > span {
  color: var(--text-color-light);
  font-size: 12px;
  line-height: 1.5;
}

.overview-card-arrow {
  color: var(--text-color-lighter);
  transition: color 0.15s, transform 0.15s;
}

.overview-card:hover .overview-card-arrow,
.overview-card:focus-visible .overview-card-arrow {
  color: var(--brand-color);
  transform: translateX(2px);
}

@media (max-width: 959px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
