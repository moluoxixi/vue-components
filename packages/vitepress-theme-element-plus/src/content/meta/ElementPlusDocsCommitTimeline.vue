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
    v-if="props.commits.length"
    class="component-commit-timeline"
    :aria-label="formatElementPlusDocsMessage(props.messages.changelog.aria, { name: props.name })"
  >
    <li v-for="commit in props.commits" :key="commit.sha" class="component-commit">
      <span class="component-commit-marker" aria-hidden="true" />
      <div data-docs-ui class="component-commit-content">
        <a class="component-commit-message" :href="commit.url" target="_blank" rel="noreferrer">
          {{ commit.message }}
        </a>
        <div class="component-commit-meta">
          <component
            :is="commit.author.profileUrl ? 'a' : 'span'"
            class="component-commit-author"
            :href="commit.author.profileUrl"
            :target="commit.author.profileUrl ? '_blank' : undefined"
            :rel="commit.author.profileUrl ? 'noreferrer' : undefined"
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
          </component>
          <time v-if="commit.date" :datetime="commit.date">{{ formatDate(commit.date) }}</time>
          <a
            class="component-commit-sha"
            :href="commit.url"
            target="_blank"
            rel="noreferrer"
            :aria-label="formatElementPlusDocsMessage(props.messages.changelog.commitLink, { sha: commit.shortSha })"
          >{{ commit.shortSha }}</a>
        </div>
      </div>
    </li>
  </ol>
  <p v-else class="component-commit-empty">
    {{ props.messages.changelog.empty }}
  </p>
</template>

<style scoped>
.component-commit-timeline {
  margin: 16px 0 28px !important;
  padding: 0 !important;
  list-style: none !important;
}

.component-commit {
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 12px;
  padding: 0 0 18px;
}

.component-commit:last-child {
  padding-bottom: 0;
}

.component-commit::before {
  position: absolute;
  top: 8px;
  bottom: -8px;
  left: 6px;
  width: 1px;
  background: var(--ep-docs-mx-border-light);
  content: '';
}

.component-commit:last-child::before {
  display: none;
}

.component-commit-marker {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  margin: 7px 0 0 3px;
  border: 2px solid var(--epd-bg-color, var(--ep-docs-bg-color));
  border-radius: 50%;
  background: var(--ep-docs-brand-color);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ep-docs-brand-color) 45%, var(--ep-docs-mx-border));
}

.component-commit-content {
  min-width: 0;
}

.component-commit-message {
  display: inline;
  color: var(--ep-docs-text-color);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.component-commit-message:hover,
.component-commit-message:focus-visible {
  color: var(--ep-docs-brand-color);
  text-decoration: none;
}

.component-commit-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 4px;
  color: var(--ep-docs-text-color-lighter);
  font-size: 12px;
  line-height: 20px;
}

.component-commit-author {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: var(--ep-docs-text-color-light);
  text-decoration: none;
}

.component-commit-author img {
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
}

.component-commit-sha {
  color: var(--ep-docs-text-color-lighter);
  font-family: var(--ep-docs-font-family-mono);
  text-decoration: none;
}

.component-commit-author:hover,
.component-commit-author:focus-visible,
.component-commit-sha:hover,
.component-commit-sha:focus-visible {
  color: var(--ep-docs-brand-color);
  text-decoration: none;
}

.component-commit-empty {
  color: var(--ep-docs-text-color-lighter);
  font-size: 13px;
}
</style>
