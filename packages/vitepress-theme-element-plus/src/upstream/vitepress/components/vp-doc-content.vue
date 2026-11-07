<script lang="ts" setup>
import { useData } from 'vitepress'
import VPPageFooter from './doc-content/vp-page-footer.vue'
import VPPageNav from './doc-content/vp-page-nav.vue'
import VPTableOfContent from './doc-content/vp-table-of-content.vue'

const { page } = useData()
</script>

<template>
  <div class="doc-content-wrapper">
    <VPTableOfContent v-if="page.headers?.length" />
    <div class="doc-content-container">
      <Content class="doc-content" />
      <VPPageFooter />
      <VPPageNav />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/mixins' as *;

.doc-content-wrapper {
  --ep-docs-vp-content-width: 800px;

  display: flex;
  flex-direction: column;
  padding: 32px 24px;

  > .doc-content-container {
    min-width: 0;
    order: 1;

    > .doc-content {
      width: 100%;
    }

    @include respond-to('xxl') {
      min-width: var(--ep-docs-vp-content-width);
      width: 100%;
    }
  }

  @include respond-to('md') {
    padding: 48px 32px;
  }
  @include respond-to('lg') {
    padding: 48px 32px;
  }
  @include respond-to('xxl') {
    padding: 48px 0 48px 48px;
    flex-direction: row;
  }
  @include respond-to('max') {
    padding: 56px 0 48px 56px;
  }
}
</style>
