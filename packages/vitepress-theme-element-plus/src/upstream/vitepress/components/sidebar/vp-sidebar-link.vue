<script lang="ts" setup>
import type { Link } from '../../types'
import { useRoute, withBase } from 'vitepress'
import { computed, ref, watch } from 'vue'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'

import { isActive } from '../../utils'

const props = defineProps<{
  item: Link
}>()

defineEmits(['close'])

const sidebarItem = ref<HTMLElement>()

const route = useRoute()

const activeLink = computed<boolean>(() =>
  isActive(route.data.relativePath, props.item.link),
)

watch([activeLink, sidebarItem], ([active, el]) => {
  if (active && el) {
    el.scrollIntoView?.({ block: 'nearest' })
  }
})
provideDocsUi()
</script>

<template>
  <a
    ref="sidebarItem"
    class="link" :class="{
      'active': activeLink,
      'flex items-center': props.item.promotion,
    }"
    :href="withBase(props.item.link)"
    @click="$emit('close')"
  >
    <p class="link-text">{{ props.item.text }}</p>
    <ElTag v-if="props.item.promotion" size="small" effect="plain">
      {{ props.item.promotion }}
    </ElTag>
  </a>
</template>

<style scoped lang="scss">
.link:not(.flex) {
  display: block;
}

.link {
  padding: 9px 14px;
  line-height: 1.5;
  font-size: 0.9rem;
  border-radius: 6px;

  .link-text {
    margin: 0;
  }

  .link-text + * {
    margin-left: 0.5rem;
  }
}

.link:hover .link-text {
  color: var(--ep-docs-brand-color);
  transition: color 0.25s;
}

.link.active {
  background-color: var(--ep-docs-link-active-bg-color);
  box-shadow: inset 2px 0 0 var(--ep-docs-brand-color);

  .link-text {
    font-weight: 600;
    color: var(--ep-docs-brand-color);
    transition: color 0.25s;
  }
}

.link-text {
  line-height: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ep-docs-text-color-light);
  transition: color 0.5s;
}
</style>
