<script setup lang="ts">
import type { ElementPlusDocsOverviewMessages } from '../types'
import type { ElementPlusDocsCatalogGroup, ElementPlusDocsOverviewData } from './types'
import { ArrowRight, BookOpen } from '@lucide/vue'
import ElementPlusDocsComponentOverview from './ElementPlusDocsComponentOverview.vue'

defineProps<{
  data: ElementPlusDocsOverviewData
  groups: readonly ElementPlusDocsCatalogGroup[]
  messages: ElementPlusDocsOverviewMessages
}>()
</script>

<template>
  <main class="overview-page">
    <header class="overview-header">
      <div class="overview-brand-lockup">
        <img :src="data.logo.src" width="56" height="56" :alt="data.logo.alt">
        <div>
          <p class="overview-kicker">{{ messages.brandKicker }}</p>
          <h1>{{ data.siteTitle }}</h1>
        </div>
      </div>
      <p class="overview-intro">
        {{ messages.intro }}
      </p>
      <div class="overview-actions">
        <a class="overview-action is-primary" :href="data.gettingStartedHref">
          <BookOpen :size="17" aria-hidden="true" />
          {{ messages.gettingStarted }}
        </a>
        <a class="overview-action" href="#component-catalog">
          {{ messages.browseComponents }}
          <ArrowRight :size="17" aria-hidden="true" />
        </a>
      </div>
    </header>

    <div class="overview-facts" :aria-label="messages.factsAria">
      <div v-for="fact in data.facts" :key="`${fact.value}-${fact.label}`">
        <strong>{{ fact.value }}</strong><span>{{ fact.label }}</span>
      </div>
    </div>

    <section id="component-catalog" class="overview-catalog">
      <div class="overview-catalog-heading">
        <p>{{ messages.catalogKicker }}</p>
        <h2>{{ messages.title }}</h2>
      </div>
      <ElementPlusDocsComponentOverview :groups="groups" :messages="messages" />
    </section>
  </main>
</template>
