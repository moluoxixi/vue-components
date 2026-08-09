<script setup lang="ts">
import type { ElementPlusDocsContentMessages } from '../types'
import type { ElementPlusDocsContributor } from './types'
import { ElTooltip } from 'element-plus'
import { onMounted, ref } from 'vue'
import { formatElementPlusDocsMessage } from '../format-message'

defineProps<{
  contributors: readonly ElementPlusDocsContributor[]
  messages: ElementPlusDocsContentMessages
  name: string
}>()

const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true
})

function contributionText(
  template: string,
  name: string,
  count: number,
): string {
  return formatElementPlusDocsMessage(template, { name, count })
}
</script>

<template>
  <ul
    v-if="contributors.length"
    class="doc-contributors"
    :aria-label="formatElementPlusDocsMessage(messages.contributors.aria, { name })"
  >
    <li v-for="contributor in contributors" :key="contributor.login">
      <ElTooltip
        :trigger="['hover', 'focus']"
        :enterable="true"
        :show-after="120"
        :hide-after="100"
        placement="top"
        effect="dark"
        popper-class="doc-contributor-tooltip"
        :teleported="isMounted"
      >
        <template #content>
          <span class="doc-contributor-tooltip-content">
            <strong>{{ contributor.name }}</strong>
            <span>GitHub @{{ contributor.login }}</span>
            <span>{{ contributionText(messages.contributors.contribution, name, contributor.contributions) }}</span>
          </span>
        </template>
        <a
          class="doc-contributor-link"
          :href="contributor.profileUrl"
          target="_blank"
          rel="noreferrer"
          :aria-label="`${contributor.name}, GitHub @${contributor.login}, ${contributionText(messages.contributors.contribution, name, contributor.contributions)}`"
        >
          <img
            class="doc-contributor-avatar"
            :src="contributor.avatarUrl"
            width="40"
            height="40"
            alt=""
            loading="lazy"
            decoding="async"
          >
        </a>
      </ElTooltip>
    </li>
  </ul>
  <p v-else class="doc-contributors-empty">
    {{ messages.contributors.empty }}
  </p>
</template>
