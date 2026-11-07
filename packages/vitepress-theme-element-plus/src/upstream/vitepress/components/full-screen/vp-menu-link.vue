<script lang="ts" setup>
import type { Link } from '../../types'

import VPLink from '../common/vp-link.vue'

const props = defineProps<{
  item: Link
}>()
</script>

<template>
  <VPLink
    class="is-menu-link"
    :href="props.item.link"
    :no-icon="true"
  >
    {{ props.item.text }}
  </VPLink>
</template>

<style scoped lang="scss">
.is-menu-link {
  display: block;
  font-size: 13px;
  font-weight: 500;
  line-height: 24px;
  color: var(--ep-docs-text-color);
  transition: color var(--epd-transition-duration);

  &.active {
    border-bottom: 2px solid var(--ep-docs-brand-color);
  }

  &:hover {
    color: var(--ep-docs-brand-color);
  }
}
</style>
