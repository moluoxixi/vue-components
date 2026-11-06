<script setup lang="ts">
import { isDark } from '../../composables/dark'
import { useNavbarLocale } from '../../composables/navbar-locale'
import CommonThemeToggler from '../common/vp-theme-toggler.vue'

const locale = useNavbarLocale()
</script>

<template>
  <div class="theme-toggler-content">
    <CommonThemeToggler
      :aria-label="locale['theme-toggler']"
      :aria-checked="isDark"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.theme-toggler-content {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 36px;
}
</style>
