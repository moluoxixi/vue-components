<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { provideWorkbenchController, useWorkbenchRouteSync, WorkbenchAppearanceDrawer } from './app'

const props = defineProps<{
  locale?: DesignerLocaleOptions
}>()

const { controller, ui } = provideWorkbenchController(props)

// The URL owns the open project and Surface, so the workspace and the route stay
// in sync instead of a local view flag.
useWorkbenchRouteSync({ controller, ui })
</script>

<template>
  <RouterView />
  <WorkbenchAppearanceDrawer
    :open="ui.appearanceDrawerOpen.value"
    :locale="controller.localeOptions.value"
    :palette-family="ui.paletteFamily.value"
    :theme-preference="ui.themePreference.value"
    @close="ui.closeAppearanceDrawer"
    @set-palette-family="ui.setPaletteFamily"
    @set-theme-preference="ui.setThemePreference"
  />
</template>
