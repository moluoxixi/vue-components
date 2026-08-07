<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { useSidebar } from '../composables/sidebar'
import VPHeroContent from './vp-hero-content.vue'
import VPDocContent from './vp-doc-content.vue'
import VPNotFound from './vp-not-found.vue'
import VPFooter from './globals/vp-footer.vue'

const { frontmatter, page } = useData()
const isNotFound = computed(() => page.value.isNotFound)
const isHeroPost = computed(() => frontmatter.value.page === true)
const { hasSidebar } = useSidebar()
</script>

<template>
  <main
    id="page-content"
    :class="['page-content', frontmatter.pageClass, { 'has-sidebar': hasSidebar }]"
  >
    <VPNotFound v-if="isNotFound" />
    <VPHeroContent v-else-if="isHeroPost" />
    <VPDocContent v-else>
      <template #content-top><slot name="content-top" /></template>
      <template #content-bottom><slot name="content-bottom" /></template>
    </VPDocContent>
    <VPFooter v-if="!isHeroPost && !isNotFound" />
  </main>
</template>
