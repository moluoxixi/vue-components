<script setup lang="ts">
import type { ElementPlusDocsContentMessages } from '../types'
import type { ElementPlusDocsContributor } from './types'
import { ElTooltip } from 'element-plus'
import { onMounted, ref } from 'vue'
import { formatElementPlusDocsMessage } from '../format-message'

const props = defineProps<{
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

function contributorInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = words.length > 1
    ? `${words[0][0] ?? ''}${words.at(-1)?.[0] ?? ''}`
    : Array.from(words[0] ?? '?').slice(0, 2).join('')
  return initials.toLocaleUpperCase()
}

function contributorAriaLabel(contributor: ElementPlusDocsContributor): string {
  const identity = contributor.login
    ? `${contributor.name}, @${contributor.login}`
    : contributor.name
  return `${identity}, ${contributionText(props.messages.contributors.contribution, props.name, contributor.contributions)}`
}
</script>

<template>
  <ul
    v-if="contributors.length"
    class="doc-contributors"
    :aria-label="formatElementPlusDocsMessage(messages.contributors.aria, { name })"
  >
    <li v-for="contributor in contributors" :key="contributor.id">
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
            <span v-if="contributor.login">@{{ contributor.login }}</span>
            <span>{{ contributionText(messages.contributors.contribution, name, contributor.contributions) }}</span>
          </span>
        </template>
        <component
          :is="contributor.profileUrl ? 'a' : 'span'"
          class="doc-contributor-link"
          :href="contributor.profileUrl"
          :target="contributor.profileUrl ? '_blank' : undefined"
          :rel="contributor.profileUrl ? 'noreferrer' : undefined"
          :aria-label="contributorAriaLabel(contributor)"
        >
          <img
            v-if="contributor.avatarUrl"
            class="doc-contributor-avatar"
            :src="contributor.avatarUrl"
            width="40"
            height="40"
            alt=""
            loading="lazy"
            decoding="async"
          >
          <span v-else class="doc-contributor-initials" aria-hidden="true">
            {{ contributorInitials(contributor.name) }}
          </span>
        </component>
      </ElTooltip>
    </li>
  </ul>
  <p v-else class="doc-contributors-empty">
    {{ messages.contributors.empty }}
  </p>
</template>
