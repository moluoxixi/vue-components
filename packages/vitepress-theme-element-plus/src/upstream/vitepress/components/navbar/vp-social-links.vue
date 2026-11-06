<script setup lang="ts">
import { useSocialLinks } from '../../composables/social-links'
import VPSocialLink from './vp-social-link.vue'

const links = useSocialLinks()
</script>

<template>
  <div class="social-links">
    <VPSocialLink v-for="link in links" :key="link.text" v-bind="link" />
  </div>
</template>

<style scoped lang="scss">
.social-links {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 36px;
}
</style>
