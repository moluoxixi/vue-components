<script setup lang="ts">
import type { ElementPlusDocsOverviewMessages } from '../types'
import type { ElementPlusDocsCatalogGroup, ElementPlusDocsOverviewData } from './types'
import { ArrowRight, BookOpen } from '@lucide/vue'
import ElementPlusDocsComponentOverview from './ElementPlusDocsComponentOverview.vue'

const props = defineProps<{
  data: ElementPlusDocsOverviewData
  groups: readonly ElementPlusDocsCatalogGroup[]
  messages: ElementPlusDocsOverviewMessages
}>()
</script>

<template>
  <main data-docs-ui class="overview-page">
    <header class="overview-header">
      <div class="overview-brand-lockup">
        <img :src="props.data.logo.src" width="56" height="56" :alt="props.data.logo.alt">
        <div>
          <p class="overview-kicker">
            {{ props.messages.brandKicker }}
          </p>
          <h1>{{ props.data.siteTitle }}</h1>
        </div>
      </div>
      <p class="overview-intro">
        {{ props.messages.intro }}
      </p>
      <div class="overview-actions">
        <a class="overview-action is-primary" :href="props.data.gettingStartedHref">
          <BookOpen :size="17" aria-hidden="true" />
          {{ props.messages.gettingStarted }}
        </a>
        <a class="overview-action" href="#component-catalog">
          {{ props.messages.browseComponents }}
          <ArrowRight :size="17" aria-hidden="true" />
        </a>
      </div>
    </header>

    <div class="overview-facts" :aria-label="props.messages.factsAria">
      <div v-for="fact in props.data.facts" :key="`${fact.value}-${fact.label}`">
        <strong>{{ fact.value }}</strong><span>{{ fact.label }}</span>
      </div>
    </div>

    <section id="component-catalog" class="overview-catalog">
      <div class="overview-catalog-heading">
        <p>{{ props.messages.catalogKicker }}</p>
        <h2>{{ props.messages.title }}</h2>
      </div>
      <ElementPlusDocsComponentOverview :groups="props.groups" :messages="props.messages" />
    </section>
  </main>
</template>

<style scoped>
.overview-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 40px 0 72px;
}

.overview-header {
  max-width: 780px;
}

.overview-brand-lockup {
  display: flex;
  align-items: center;
  gap: 16px;
}

.overview-brand-lockup img {
  flex: none;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.2);
}

.overview-kicker,
.overview-catalog-heading > p {
  margin: 0 0 4px;
  color: var(--ep-docs-brand-color);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.overview-page h1 {
  margin: 0;
  color: var(--ep-docs-text-color);
  font-size: 38px;
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: 0;
}

.overview-intro {
  max-width: 680px;
  margin: 18px 0 0;
  color: var(--ep-docs-text-color-light);
  font-size: 16px;
  line-height: 1.7;
}

.overview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.overview-action {
  display: inline-flex;
  height: 38px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 15px;
  border: 1px solid var(--ep-docs-mx-border);
  border-radius: 4px;
  color: var(--ep-docs-text-color);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}

.overview-action:hover {
  border-color: var(--ep-docs-brand-color);
  color: var(--ep-docs-brand-color);
  text-decoration: none;
}

.overview-action.is-primary {
  border-color: var(--ep-docs-brand-color);
  background: var(--ep-docs-brand-color);
  color: #fff;
}

.overview-action.is-primary:hover {
  border-color: var(--epd-color-primary-dark-2);
  background: var(--epd-color-primary-dark-2);
  color: #fff;
}

.overview-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 32px 0 36px;
  border-top: 1px solid var(--ep-docs-mx-border);
  border-bottom: 1px solid var(--ep-docs-mx-border);
}

.overview-facts > div {
  display: flex;
  min-height: 76px;
  flex-direction: column;
  justify-content: center;
  padding: 12px 20px;
  border-right: 1px solid var(--ep-docs-mx-border-light);
}

.overview-facts > div:first-child {
  padding-left: 0;
}

.overview-facts > div:last-child {
  border-right: 0;
}

.overview-facts strong {
  color: var(--ep-docs-text-color);
  font-size: 16px;
  font-weight: 600;
}

.overview-facts span {
  margin-top: 3px;
  color: var(--ep-docs-text-color-lighter);
  font-size: 12px;
}

.overview-catalog-heading h2 {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--ep-docs-text-color);
  font-size: 26px;
  letter-spacing: 0;
}

@media (max-width: 959px) {
  .overview-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 959px) {

  .overview-facts > div:nth-child(2) {
    border-right: 0;
  }
}

@media (max-width: 959px) {

  .overview-facts > div:nth-child(-n+2) {
    border-bottom: 1px solid var(--ep-docs-mx-border-light);
  }
}

@media (max-width: 959px) {

  .overview-facts > div:nth-child(3) {
    padding-left: 0;
  }
}

@media (max-width: 639px) {
  .overview-page {
    width: min(100% - 32px, 1180px);
    padding-top: 30px;
  }
}

@media (max-width: 639px) {

  .overview-brand-lockup {
    align-items: flex-start;
  }
}

@media (max-width: 639px) {

  .overview-brand-lockup img {
    width: 48px;
    height: 48px;
  }
}

@media (max-width: 639px) {

  .overview-page h1 {
    font-size: 32px;
  }
}

@media (max-width: 639px) {

  .overview-intro {
    margin-top: 16px;
    font-size: 15px;
  }
}

@media (max-width: 639px) {

  .overview-actions {
    margin-top: 20px;
  }
}

@media (max-width: 639px) {

  .overview-action {
    flex: 1 1 140px;
  }
}

@media (max-width: 639px) {

  .overview-facts {
    margin: 30px 0 36px;
  }
}

@media (max-width: 639px) {

  .overview-facts > div {
    min-height: 68px;
    padding: 10px 12px;
  }
}
</style>
