<script setup lang="ts">
import type { ElementPlusDocsContentMessages } from '../types'
import type { ElementPlusDocsCommit } from './types'
import { computed } from 'vue'
import { formatElementPlusDocsMessage } from '../format-message'

const props = defineProps<{
  commits: readonly ElementPlusDocsCommit[]
  locale: string
  messages: ElementPlusDocsContentMessages
  name: string
}>()

const dateFormatter = computed(() => {
  try {
    return new Intl.DateTimeFormat(props.locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  catch {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
})

function formatDate(date: string): string {
  if (!date)
    return ''

  const value = new Date(date)
  return Number.isNaN(value.getTime()) ? date : dateFormatter.value.format(value)
}
</script>

<template>
  <ol
    v-if="commits.length"
    class="component-commit-timeline"
    :aria-label="formatElementPlusDocsMessage(messages.changelog.aria, { name })"
  >
    <li v-for="commit in commits" :key="commit.sha" class="component-commit">
      <span class="component-commit-marker" aria-hidden="true" />
      <div class="component-commit-content">
        <a class="component-commit-message" :href="commit.url" target="_blank" rel="noreferrer">
          {{ commit.message }}
        </a>
        <div class="component-commit-meta">
          <a
            v-if="commit.author.profileUrl"
            class="component-commit-author"
            :href="commit.author.profileUrl"
            target="_blank"
            rel="noreferrer"
          >
            <img
              v-if="commit.author.avatarUrl"
              :src="commit.author.avatarUrl"
              width="20"
              height="20"
              alt=""
              loading="lazy"
              decoding="async"
            >
            <span>{{ commit.author.name }}</span>
          </a>
          <span v-else class="component-commit-author">{{ commit.author.name }}</span>
          <time v-if="commit.date" :datetime="commit.date">{{ formatDate(commit.date) }}</time>
          <a
            class="component-commit-sha"
            :href="commit.url"
            target="_blank"
            rel="noreferrer"
            :aria-label="formatElementPlusDocsMessage(messages.changelog.commitLink, { sha: commit.shortSha })"
          >{{ commit.shortSha }}</a>
        </div>
      </div>
    </li>
  </ol>
  <p v-else class="component-commit-empty">
    {{ messages.changelog.empty }}
  </p>
</template>
