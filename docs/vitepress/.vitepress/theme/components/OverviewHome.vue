<script setup lang="ts">
import { ArrowRight, BookOpen } from '@lucide/vue'
import { withBase } from 'vitepress'
import { computed } from 'vue'
import { documentedComponents } from '../../component-manifest'
import { docsRoutePath, docsSite } from '../../docs-site'
import ComponentOverview from './ComponentOverview.vue'
import { useDocsLocale } from '../use-docs-locale'

const { link, messages } = useDocsLocale()
const logoSrc = withBase(docsSite.logo.src)
const gettingStartedHref = computed(() => link(docsRoutePath('guide', 'getting-started.html')))
</script>

<template>
  <main class="overview-page">
    <header class="overview-header">
      <div class="overview-brand-lockup">
        <img :src="logoSrc" width="56" height="56" :alt="docsSite.logo.alt">
        <div>
          <p class="overview-kicker">{{ messages.overview.brandKicker }}</p>
          <h1>{{ docsSite.siteTitle }}</h1>
        </div>
      </div>
      <p class="overview-intro">
        {{ messages.overview.intro }}
      </p>
      <div class="overview-actions">
        <a class="overview-action is-primary" :href="gettingStartedHref">
          <BookOpen :size="17" aria-hidden="true" />
          {{ messages.overview.gettingStarted }}
        </a>
        <a class="overview-action" href="#component-catalog">
          {{ messages.overview.browseComponents }}
          <ArrowRight :size="17" aria-hidden="true" />
        </a>
      </div>
    </header>

    <div class="overview-facts" :aria-label="messages.overview.factsAria">
      <div><strong>{{ documentedComponents.length }}</strong><span>{{ messages.overview.componentDocs }}</span></div>
      <div><strong>Vue 3.5</strong><span>{{ messages.overview.runtime }}</span></div>
      <div><strong>TypeScript</strong><span>{{ messages.overview.typedContracts }}</span></div>
      <div><strong>Element Plus</strong><span>{{ messages.overview.visualInteraction }}</span></div>
    </div>

    <section id="component-catalog" class="overview-catalog">
      <div class="overview-catalog-heading">
        <p>{{ messages.overview.catalogKicker }}</p>
        <h2>{{ messages.overview.title }}</h2>
      </div>
      <ComponentOverview />
    </section>
  </main>
</template>
