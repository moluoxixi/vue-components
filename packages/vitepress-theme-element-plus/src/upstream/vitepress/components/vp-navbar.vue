<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed } from 'vue'
import { provideDocsUi } from '../../../runtime/provide-docs-ui'
import { resolveNavbarIdentity } from '../composables/navbar-identity'
import { useSiteLocales } from '../composables/site-locale'
import VPNavbarHamburger from './navbar/vp-hamburger.vue'
import VPNavbarMenu from './navbar/vp-menu.vue'
import VPNavbarSearch from './navbar/vp-search.vue'
import VPNavbarSocialLinks from './navbar/vp-social-links.vue'
import VPNavbarThemeToggler from './navbar/vp-theme-toggler.vue'
import VPNavbarTranslation from './navbar/vp-translation.vue'

const props = defineProps<{
  fullScreen: boolean
}>()

defineEmits(['toggle'])

const { theme, site } = useData()
const { homePath: currentLink } = useSiteLocales()

const identity = computed(() => resolveNavbarIdentity(theme.value.logo, theme.value.siteTitle, site.value.title))
const showVersion = computed(() => String(theme.value.version ?? ''))
provideDocsUi()
</script>

<template>
  <div class="navbar-wrapper">
    <div class="header-container epdocs:flex epdocs:min-w-0 epdocs:items-center epdocs:justify-between">
      <div class="logo-container">
        <a :href="withBase(currentLink)">
          <img
            v-if="identity.logo"
            class="logo"
            :src="withBase(identity.logo)"
            :alt="identity.siteTitle"
          >
          <span v-else class="site-title" :title="identity.siteTitle">{{ identity.siteTitle }}</span>
        </a>

        <el-tag v-if="showVersion" round size="small">
          <span>{{ showVersion }}</span>
        </el-tag>
      </div>
      <div class="content epdocs:flex epdocs:items-center epdocs:justify-end epdocs:gap-1">
        <VPNavbarMenu class="menu" />
        <VPNavbarSearch class="search" />
        <VPNavbarThemeToggler class="theme-toggler" />
        <VPNavbarTranslation class="translation" />
        <VPNavbarSocialLinks class="social-links" />
        <VPNavbarHamburger
          :active="props.fullScreen"
          class="hamburger"
          @click="$emit('toggle')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/mixins' as *;

// import components

.navbar-wrapper {
  position: relative;
  border-bottom: 1px solid var(--ep-docs-border-color);
  height: var(--ep-docs-header-height);
  padding: 0 16px;
  background-color: color-mix(in srgb, var(--ep-docs-bg-color) 96%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  top: 0;

  @include respond-to('md') {
    padding: 0 24px;
  }

  @include respond-to('xlg') {
    padding: 0 32px;
  }

  @include respond-to('max') {
    padding: 0 48px;
  }

  .header-container {
    margin: 0 auto;

    .content {
      flex: none;

      > :deep(.search) {
        flex-grow: 0;
        padding-left: 0;
      }
    }
  }

  @include respond-to('md') {
    .content {
      padding-top: 1px;
    }
  }
}

.menu + .appearance {
  margin-left: 8px;
}

.menu + .social-links {
  margin-left: 12px;
}

.appearance + .social-links {
  margin-left: 12px;
}

.logo-container {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-right: 16px;
  height: var(--ep-docs-header-height);
  > a {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 34px;
    color: var(--ep-docs-text-color);
    text-decoration: none;
  }
  .logo {
    width: 34px;
    height: 34px;
    flex: none;
  }
  .site-title {
    overflow: hidden;
    font-size: 18px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
