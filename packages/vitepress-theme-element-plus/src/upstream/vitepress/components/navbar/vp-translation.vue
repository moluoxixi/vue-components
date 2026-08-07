<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { useTranslation } from '../../composables/translation'

const { switchLang, languageMap, langs, locale } =
  useTranslation()
</script>

<template>
  <div class="translation-container">
    <ClientOnly>
      <ElDropdown popper-class="translation-popup" role="navigation">
        <ElIcon :size="24" :aria-label="locale.language">
          <Languages />
        </ElIcon>
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
  display: none;
  height: 24px;
  padding: 0 12px;
  cursor: pointer;

  @include respond-to('md') {
    display: block;
  }
}
</style>

<style lang="scss">
.el-dropdown__popper.translation-popup {
  --el-bg-color-overlay: var(--bg-color);
  --el-popper-border-radius: 8px;
  --el-border-color-light: transparent;

  padding: 7px 0;
  min-width: 192px;
  transition: background-color 0.5s;

  .el-popper__arrow {
    display: none;
  }

  .language {
    padding: 0 16px;
    line-height: 28px;

  }
}
</style>
