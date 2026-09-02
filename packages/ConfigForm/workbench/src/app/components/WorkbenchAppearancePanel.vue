<script setup lang="ts">
import type {
  WorkbenchAppearancePanelEmits,
  WorkbenchAppearancePanelProps,
  WorkbenchPaletteFamily,
  WorkbenchThemePreference,
} from '../types'
import { Check } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import {
  WORKBENCH_PALETTE_FAMILIES,
  WORKBENCH_PALETTE_SWATCHES,
  WORKBENCH_THEME_PREFERENCES,
} from '../constants'

const props = defineProps<WorkbenchAppearancePanelProps>()
const emit = defineEmits<WorkbenchAppearancePanelEmits>()
const locale = computed(() => createDesignerLocale(props.locale))
const themeFallbacks: Record<WorkbenchThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}
const paletteFallbacks: Record<WorkbenchPaletteFamily, string> = {
  catppuccin: 'Catppuccin',
  kanagawa: 'Kanagawa',
  gruvbox: 'Gruvbox',
  'rose-pine': 'Rosé Pine',
}

const themeOptions = computed(() => WORKBENCH_THEME_PREFERENCES.map(value => ({
  label: locale.value.t(`appearance.mode.${value}`, themeFallbacks[value]),
  value,
})))

const paletteOptions = computed(() => WORKBENCH_PALETTE_FAMILIES.map(value => ({
  label: locale.value.t(`appearance.palette.${value}`, paletteFallbacks[value]),
  value,
})))

function setThemePreference(value: unknown): void {
  if (WORKBENCH_THEME_PREFERENCES.includes(value as WorkbenchThemePreference))
    emit('setThemePreference', value as WorkbenchThemePreference)
}

function setPaletteFamily(value: unknown): void {
  if (WORKBENCH_PALETTE_FAMILIES.includes(value as WorkbenchPaletteFamily))
    emit('setPaletteFamily', value as WorkbenchPaletteFamily)
}
</script>

<template>
  <section class="appearance-panel" :aria-label="locale.t('appearance.title', 'Appearance')">
    <header class="appearance-panel__header">
      <h2>{{ locale.t('appearance.title', 'Appearance') }}</h2>
    </header>

    <div class="appearance-field">
      <span class="appearance-field__label">{{ locale.t('appearance.mode', 'Mode') }}</span>
      <ElSegmented
        class="appearance-mode-control"
        :model-value="themePreference"
        :options="themeOptions"
        :aria-label="locale.t('appearance.mode', 'Mode')"
        @update:model-value="setThemePreference"
      />
    </div>

    <div class="appearance-field">
      <span id="appearance-palette-label" class="appearance-field__label">{{ locale.t('appearance.palette', 'Color theme') }}</span>
      <ElRadioGroup
        class="appearance-palette-list"
        :model-value="paletteFamily"
        aria-labelledby="appearance-palette-label"
        @update:model-value="setPaletteFamily"
      >
        <ElRadio
          v-for="option in paletteOptions"
          :key="option.value"
          class="appearance-palette-option"
          :value="option.value"
        >
          <span class="appearance-palette-option__body">
            <span class="appearance-palette-option__name">{{ option.label }}</span>
            <span class="appearance-palette-option__preview" aria-hidden="true">
              <span class="appearance-swatch appearance-swatch--light">
                <i v-for="color in WORKBENCH_PALETTE_SWATCHES[option.value].light" :key="color" :style="{ backgroundColor: color }" />
              </span>
              <span class="appearance-swatch appearance-swatch--dark">
                <i v-for="color in WORKBENCH_PALETTE_SWATCHES[option.value].dark" :key="color" :style="{ backgroundColor: color }" />
              </span>
            </span>
            <Check v-if="paletteFamily === option.value" class="appearance-palette-option__check" :size="16" aria-hidden="true" />
          </span>
        </ElRadio>
      </ElRadioGroup>
    </div>
  </section>
</template>
