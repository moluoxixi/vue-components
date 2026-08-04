<script setup lang="ts">
import { computed } from 'vue'
import { formatDocsMessage } from '../../docs-i18n'
import { getComponentGithubMetadata, githubMetadata } from '../../github-metadata'
import { useDocsLocale } from '../use-docs-locale'

const props = defineProps<{
  name: string
}>()

const { messages } = useDocsLocale()
const contributors = computed(() => getComponentGithubMetadata(props.name).contributors
  .map((contribution) => {
    const profile = githubMetadata.profiles[contribution.login]
    return profile ? { ...profile, contributions: contribution.contributions } : undefined
  })
  .filter(contributor => contributor !== undefined))

function contributionText(count: number): string {
  return formatDocsMessage(messages.value.contributors.contribution, {
    name: props.name,
    count,
  })
}
</script>

<template>
  <ul
    v-if="contributors.length"
    class="doc-contributors"
    :aria-label="formatDocsMessage(messages.contributors.aria, { name })"
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
        :teleported="true"
      >
        <template #content>
          <span class="doc-contributor-tooltip-content">
            <strong>{{ contributor.name }}</strong>
            <span>GitHub @{{ contributor.login }}</span>
            <span>{{ contributionText(contributor.contributions) }}</span>
          </span>
        </template>
        <a
          class="doc-contributor-link"
          :href="contributor.profileUrl"
          target="_blank"
          rel="noreferrer"
          :aria-label="`${contributor.name}, GitHub @${contributor.login}, ${contributionText(contributor.contributions)}`"
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
