<script setup lang="ts">
import { computed } from 'vue'
import { formatDocsMessage } from '../../docs-i18n'
import { getComponentGithubMetadata } from '../../github-metadata'
import { useDocsLocale } from '../use-docs-locale'

const props = defineProps<{
  name: string
}>()

const { locale, messages } = useDocsLocale()
const commits = computed(() => getComponentGithubMetadata(props.name).commits)
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}))

function formatDate(date: string): string {
  if (!date)
    return ''
  return dateFormatter.value.format(new Date(date))
}
</script>

<template>
  <ol
    v-if="commits.length"
    class="component-commit-timeline"
    :aria-label="formatDocsMessage(messages.changelog.aria, { name })"
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
            :aria-label="formatDocsMessage(messages.changelog.commitLink, { sha: commit.shortSha })"
          >{{ commit.shortSha }}</a>
        </div>
      </div>
    </li>
  </ol>
  <p v-else class="component-commit-empty">
    {{ messages.changelog.empty }}
  </p>
</template>
