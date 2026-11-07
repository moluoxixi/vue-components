<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { withBase } from 'vitepress'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'
import { isExternal } from '../../utils'

const props = defineProps<{
  href?: string
  noIcon?: boolean
}>()
provideDocsUi()
</script>

<template>
  <component
    :is="props.href ? 'a' : 'span'"
    class="link-item"
    :class="{ link: props.href }"
    :href="withBase(props.href ?? '')"
    :target="isExternal(props.href) ? '_blank' : undefined"
    :rel="isExternal(props.href) ? 'noopener noreferrer' : undefined"
  >
    <slot />
    <ElIcon v-if="isExternal(props.href) && !props.noIcon">
      <ExternalLink class="link-icon" />
    </ElIcon>
  </component>
</template>

<style scoped>
.link-item {
  display: flex;
  align-items: center;
}

.epd-icon {
  margin-left: 4px;
}
</style>
