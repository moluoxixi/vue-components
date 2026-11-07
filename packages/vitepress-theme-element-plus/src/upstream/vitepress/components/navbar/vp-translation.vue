<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'
import { useTranslation } from '../../composables/translation'

const { switchLang, languageMap, langs, locale }
  = useTranslation()
provideDocsUi()
</script>

<template>
  <div class="translation-container">
    <ClientOnly>
      <ElDropdown popper-class="translation-popup" trigger="click" placement="bottom-end">
        <button type="button" class="translation-trigger" :aria-label="locale.language" :title="locale.selectLanguage">
          <Languages :size="20" :stroke-width="1.75" aria-hidden="true" />
        </button>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem
              v-for="l in langs"
              :key="l"
              class="language"
              @click="switchLang(l)"
            >
              {{ languageMap[l] }}
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </ClientOnly>
  </div>
</template>

<style lang="scss" scoped>
@use '../../styles/mixins' as *;

.translation-container {
  display: flex;
  flex: none;
  align-items: center;
  height: 36px;
}

.translation-trigger {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--ep-docs-text-color-light);
  cursor: pointer;

  &:hover {
    background: var(--ep-docs-bg-color-mute);
    color: var(--ep-docs-brand-color);
  }
}
</style>

<style lang="scss" scoped>
:global(.epd-dropdown__popper.translation-popup) {
  --epd-bg-color-overlay: var(--ep-docs-bg-color);
  --epd-popper-border-radius: 8px;
  --epd-border-color-light: transparent;

  padding: 7px 0;
  min-width: 192px;
  transition: background-color 0.5s;

}

:global(.epd-dropdown__popper.translation-popup .epd-popper__arrow) {
  display: none;
}

:global(.epd-dropdown__popper.translation-popup .language) {
  padding: 0 16px;
  line-height: 28px;
}
</style>
