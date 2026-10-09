<script setup lang="ts">
import { FolderKanban, Languages, LibraryBig, PanelsTopLeft, Settings2 } from '@lucide/vue'
import { WorkbenchAppearancePopover } from '../../components'
import { useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import { projectsPath, templatesPath } from '../../navigation'

const props = defineProps<{
  palette: string
  theme: string
}>()
const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
</script>

<template>
  <div class="management-shell" :data-palette="props.palette" :data-theme="props.theme">
    <nav class="management-navigation" :aria-label="controller.workbenchLocale.value.t('management.navigation', 'Workspace navigation')">
      <span class="management-navigation__brand"><span class="management-navigation__mark"><PanelsTopLeft :size="18" aria-hidden="true" /></span>ConfigForm</span>
      <RouterLink :to="projectsPath()" :class="{ 'is-active': $route.path.startsWith('/projects') }" :aria-current="$route.path.startsWith('/projects') ? 'page' : undefined" :aria-label="controller.workbenchLocale.value.t('management.projects', 'Project management')">
        <FolderKanban :size="17" aria-hidden="true" /><span class="management-navigation__label">{{ controller.workbenchLocale.value.t('management.projects', 'Project management') }}</span><span class="management-navigation__compact">{{ controller.workbenchLocale.value.t('management.projectsShort', 'Projects') }}</span>
      </RouterLink>
      <RouterLink :to="templatesPath()" :class="{ 'is-active': $route.path.startsWith('/templates') }" :aria-current="$route.path.startsWith('/templates') ? 'page' : undefined" :aria-label="controller.workbenchLocale.value.t('management.templates', 'Template management')">
        <LibraryBig :size="17" aria-hidden="true" /><span class="management-navigation__label">{{ controller.workbenchLocale.value.t('management.templates', 'Template management') }}</span><span class="management-navigation__compact">{{ controller.workbenchLocale.value.t('management.templatesShort', 'Templates') }}</span>
      </RouterLink>
      <div v-if="$route.name === 'templates'" class="management-navigation__tools">
        <ElButton text circle :title="controller.workbenchLocale.value.t('locale.switch', 'Switch language')" :aria-label="controller.workbenchLocale.value.t('locale.switch', 'Switch language')" @click="ui.toggleLocale">
          <Languages :size="17" aria-hidden="true" />
        </ElButton>
        <WorkbenchAppearancePopover trigger-class="management-navigation__appearance-desktop" :locale="controller.localeOptions.value" :palette-family="ui.paletteFamily.value" :theme-preference="ui.themePreference.value" @set-palette-family="ui.setPaletteFamily" @set-theme-preference="ui.setThemePreference" />
        <ElButton class="management-navigation__appearance-mobile" text circle :title="controller.workbenchLocale.value.t('appearance.open', 'Open appearance settings')" :aria-label="controller.workbenchLocale.value.t('appearance.open', 'Open appearance settings')" @click="ui.openAppearanceDrawer">
          <Settings2 :size="17" aria-hidden="true" />
        </ElButton>
      </div>
    </nav>
    <div class="management-shell__content">
      <slot />
    </div>
  </div>
</template>
