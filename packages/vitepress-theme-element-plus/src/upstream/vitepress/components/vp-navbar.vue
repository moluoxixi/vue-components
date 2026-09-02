<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { resolveNavbarIdentity } from '../composables/navbar-identity'
import { useSiteLocales } from '../composables/site-locale'
import VPNavbarSearch from './navbar/vp-search.vue'
import VPNavbarMenu from './navbar/vp-menu.vue'
import VPNavbarThemeToggler from './navbar/vp-theme-toggler.vue'
import VPNavbarTranslation from './navbar/vp-translation.vue'
import VPNavbarSocialLinks from './navbar/vp-social-links.vue'
import VPNavbarHamburger from './navbar/vp-hamburger.vue'

defineProps<{
  fullScreen: boolean
}>()

defineEmits(['toggle'])

const { theme, site } = useData()
const { homePath: currentLink } = useSiteLocales()

const identity = computed(() => resolveNavbarIdentity(theme.value.logo, theme.value.siteTitle, site.value.title))
const showVersion = computed(() => String(theme.value.version ?? ''))
</script>

<template>
  <div class="navbar-wrapper">
    <div class="header-container">
      <div class="logo-container">
        <a :href="withBase(currentLink)">
          <img
            v-if="identity.logo"
            class="logo"
            :src="withBase(identity.logo)"
            :alt="identity.siteTitle"
          />
          <span v-else class="site-title" :title="identity.siteTitle">{{ identity.siteTitle }}</span>
        </a>

        <el-tag v-if="showVersion" round size="small">
          <span>{{ showVersion }}</span>
        </el-tag>
      </div>
      <div class="content">
        <VPNavbarMenu class="menu" />
        <VPNavbarSearch class="search" />
        <VPNavbarThemeToggler class="theme-toggler" />
        <VPNavbarTranslation class="translation" />
        <VPNavbarSocialLinks class="social-links" />
        <VPNavbarHamburger
          :active="fullScreen"
          class="hamburger"
          @click="$emit('toggle')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.logo-container {
  display: flex;
  align-items: center;
  height: var(--header-height);
  > a {
    display: flex;
    align-items: center;
    height: 28px;
    width: 128px;
    color: var(--text-color);
    text-decoration: none;
  }
  .logo {
    position: relative;
    height: 100%;
  }
  .site-title {
    overflow: hidden;
    font-size: 18px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.dark {
  .logo {
    filter: drop-shadow(2px 2px 6px #409eff);
  }
}
</style>
