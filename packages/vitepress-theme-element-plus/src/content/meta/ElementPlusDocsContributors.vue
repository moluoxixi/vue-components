<script setup lang="ts">
import type { ElementPlusDocsContentMessages } from '../types'
import type { ElementPlusDocsContributor } from './types'
import { ElTooltip } from 'element-plus'
import { onMounted, ref } from 'vue'
import { provideDocsUi } from '../../runtime/provide-docs-ui'
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
provideDocsUi()
</script>

<template>
  <ul
    v-if="props.contributors.length"
    data-docs-ui
    class="doc-contributors"
    :aria-label="formatElementPlusDocsMessage(props.messages.contributors.aria, { name: props.name })"
  >
    <li v-for="contributor in props.contributors" :key="contributor.id">
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
            <span>{{ contributionText(props.messages.contributors.contribution, props.name, contributor.contributions) }}</span>
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
    {{ props.messages.contributors.empty }}
  </p>
</template>

<style scoped>
.doc-contributors {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 24px !important;
  padding: 0 !important;
  list-style: none !important;
}

.doc-contributors li {
  width: 40px;
  height: 40px;
}

.doc-contributor-link {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ep-docs-mx-border);
  border-radius: 50%;
  overflow: hidden;
  background: var(--ep-docs-mx-fill);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.doc-contributor-link:hover,
.doc-contributor-link:focus-visible {
  border-color: var(--ep-docs-brand-color);
  box-shadow: 0 0 0 2px var(--ep-docs-link-active-bg-color);
  text-decoration: none;
  transform: translateY(-1px);
  outline: none;
}

.doc-contributor-avatar {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.doc-contributor-initials {
  display: inline-flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ep-docs-brand-color) 12%, var(--ep-docs-mx-fill));
  color: var(--ep-docs-brand-color);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.doc-contributors-empty {
  color: var(--ep-docs-text-color-lighter);
  font-size: 12px;
}

:global(.epd-popper.doc-contributor-tooltip) {
  max-width: min(260px, calc(100vw - 32px));
}

.doc-contributor-tooltip-content {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  gap: 2px;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.6;
  white-space: normal;
}

.doc-contributor-tooltip-content strong {
  font-size: 13px;
  font-weight: 600;
}
</style>
