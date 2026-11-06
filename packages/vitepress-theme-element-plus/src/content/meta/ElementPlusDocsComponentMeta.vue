<script setup lang="ts">
import { provideDocsUi } from '../../runtime/provide-docs-ui'
import type { ElementPlusDocsContentMessages } from '../types'
import type { ElementPlusDocsComponentMetaData } from './types'
import {
  Check,
  CircleDot,
  FilePenLine,
  FolderGit2,
  History,
  ListTodo,
  MessageSquareWarning,
  PanelsTopLeft,
  X,
} from '@lucide/vue'
import { ElDialog } from 'element-plus'
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatElementPlusDocsMessage } from '../format-message'
import ElementPlusDocsCommitTimeline from './ElementPlusDocsCommitTimeline.vue'

const props = defineProps<{
  copyText?: (text: string) => Promise<void> | void
  data: ElementPlusDocsComponentMetaData
  locale: string
  messages: ElementPlusDocsContentMessages
}>()

const changelogVisible = ref(false)
const changelogTrigger = ref<HTMLButtonElement>()
const copied = ref(false)
const copying = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const changelogTitle = computed(() => formatElementPlusDocsMessage(
  props.messages.changelog.aria,
  { name: props.data.name },
))

async function copyImport(): Promise<void> {
  if (copying.value)
    return

  copying.value = true
  try {
    if (props.copyText)
      await props.copyText(props.data.importStatement)
    else if (typeof navigator !== 'undefined' && navigator.clipboard)
      await navigator.clipboard.writeText(props.data.importStatement)
    else
      return

    copied.value = true
    if (copiedTimer)
      clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 1600)
  }
  catch {
    copied.value = false
  }
  finally {
    copying.value = false
  }
}

function restoreChangelogFocus(): void {
  changelogTrigger.value?.focus()
}

onBeforeUnmount(() => {
  if (copiedTimer)
    clearTimeout(copiedTimer)
})
provideDocsUi()
</script>

<template>
  <div data-docs-ui class="component-doc-meta" :aria-label="messages.meta.aria">
    <table class="component-doc-meta-table">
      <tbody>
        <tr>
          <th scope="row">{{ messages.meta.usage }}</th>
          <td>
            <div class="component-doc-import">
              <button
                class="component-doc-import-copy"
                type="button"
                :disabled="copying"
                :title="copied ? messages.meta.copied : messages.meta.copyImport"
                :aria-label="copied ? messages.meta.copied : messages.meta.copyImport"
                @click="copyImport"
              >
                <code>{{ data.importStatement }}</code>
                <Check v-if="copied" class="component-doc-copy-status" :size="14" aria-hidden="true" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="data.sourceHref || data.newIssueHref || data.openIssuesHref">
          <th scope="row">{{ messages.meta.feedback }}</th>
          <td>
            <div class="component-doc-links">
              <a v-if="data.sourceHref" :href="data.sourceHref" target="_blank" rel="noreferrer">
                <FolderGit2 :size="14" aria-hidden="true" />
                {{ data.sourceLabel }}
              </a>
              <a v-if="data.newIssueHref" :href="data.newIssueHref" target="_blank" rel="noreferrer">
                <MessageSquareWarning :size="14" aria-hidden="true" />
                {{ messages.meta.submitIssue }}
              </a>
              <a
                v-if="data.openIssuesHref && data.openIssueCount !== undefined"
                :href="data.openIssuesHref"
                target="_blank"
                rel="noreferrer"
              >
                <ListTodo :size="14" aria-hidden="true" />
                {{ messages.meta.openIssues }}
                <span class="component-doc-count">{{ data.openIssueCount }}</span>
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row">{{ messages.meta.documentation }}</th>
          <td>
            <div class="component-doc-links">
              <a v-if="data.editHref" :href="data.editHref" target="_blank" rel="noreferrer">
                <FilePenLine :size="14" aria-hidden="true" />
                {{ data.hasSourceDoc ? messages.meta.editPage : messages.meta.addDocs }}
              </a>
              <a :href="data.overviewHref">
                <PanelsTopLeft :size="14" aria-hidden="true" />
                {{ messages.meta.componentOverview }}
              </a>
              <a :href="data.apiHref ?? '#api'">
                <CircleDot :size="14" aria-hidden="true" />
                {{ messages.route.api }}
              </a>
              <button
                v-if="data.commits?.length"
                ref="changelogTrigger"
                type="button"
                aria-haspopup="dialog"
                :aria-expanded="changelogVisible"
                @click="changelogVisible = true"
              >
                <History :size="14" aria-hidden="true" />
                {{ messages.meta.changelog }}
                <span class="component-doc-count">{{ data.commits.length }}</span>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <ClientOnly>
      <ElDialog
        v-if="data.commits?.length"
        v-model="changelogVisible"
        align-center
        append-to-body
        class="component-changelog-dialog"
        destroy-on-close
        :show-close="false"
        width="min(760px, calc(100vw - 32px))"
        @closed="restoreChangelogFocus"
      >
        <template #header="{ close, titleId, titleClass }">
          <div class="component-changelog-dialog-header">
            <span :id="titleId" :class="titleClass" role="heading" aria-level="2">{{ changelogTitle }}</span>
            <button
              class="component-changelog-dialog-close"
              type="button"
              :aria-label="messages.theme.close"
              @click="close"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>
        </template>
        <div class="component-changelog-dialog-scroll">
          <ElementPlusDocsCommitTimeline
            :commits="data.commits"
            :locale="locale"
            :messages="messages"
            :name="data.name"
          />
        </div>
      </ElDialog>
    </ClientOnly>
  </div>
</template>

<style scoped>

.component-doc-meta {
  margin: 16px 0 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--ep-docs-mx-border-light);
}

.component-doc-meta-table {
  display: table;
  width: 100%;
  min-width: 100%;
  margin: 0;
  overflow: visible;
  border: 0;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
  line-height: 22px;
}

.component-doc-meta-table tr {
  border: 0;
  background: transparent !important;
}

.component-doc-meta-table th,
.component-doc-meta-table td {
  border: 0;
  background: transparent;
  text-align: left;
  vertical-align: top;
}

.component-doc-meta-table th {
  width: 56px;
  padding: 0 16px 8px 0;
  color: var(--ep-docs-text-color-lighter);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  white-space: nowrap;
}

.component-doc-meta-table td {
  padding: 0 0 8px;
  line-height: 22px;
}

.component-doc-meta-table tr:last-child th,
.component-doc-meta-table tr:last-child td {
  padding-bottom: 0;
}

.component-doc-import,
.component-doc-links,
.component-doc-links > a,
.component-doc-links > button {
  display: flex;
  align-items: flex-start;
}

.component-doc-import {
  min-width: 0;
  color: var(--ep-docs-text-color-light);
}

.component-doc-import-copy {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ep-docs-text-color-light);
  cursor: pointer;
  text-align: left;
}

.component-doc-import-copy code {
  min-width: 0;
  padding: 0 4px;
  border-radius: 0;
  background: transparent;
  overflow-wrap: anywhere;
  color: inherit;
  font-family: var(--ep-docs-font-family-mono);
  font-size: 14px;
  line-height: 22px;
  white-space: normal;
}

.component-doc-copy-status {
  flex: none;
  margin-inline-start: 4px;
  color: var(--ep-docs-mx-success);
}

.component-doc-count {
  min-width: 1ch;
  color: var(--ep-docs-text-color-lighter);
  font-family: var(--ep-docs-font-family);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.component-doc-import-copy:hover,
.component-doc-import-copy:focus-visible {
  color: var(--ep-docs-brand-color);
  outline: none;
}

.component-doc-links {
  min-width: 0;
  flex-wrap: nowrap;
  gap: 8px;
}

.component-doc-links > a,
.component-doc-links > button {
  min-width: 0;
  gap: 4px;
  padding: 0 4px;
  overflow-wrap: anywhere;
  color: var(--ep-docs-text-color-light);
  font-family: var(--ep-docs-font-family-mono);
  font-size: 14px;
  line-height: 22px;
  text-decoration: none;
}

.component-doc-links > button {
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.component-doc-links > :is(a, button) svg {
  flex: none;
  margin-block-start: 4px;
  margin-inline-end: 4px;
}

.component-doc-links > :is(a, button):hover {
  color: var(--ep-docs-brand-color);
  text-decoration: none;
}

.component-doc-links > :is(a, button):focus-visible {
  border-radius: 2px;
  color: var(--ep-docs-brand-color);
  outline: 2px solid var(--ep-docs-brand-color);
  outline-offset: 2px;
  text-decoration: none;
}

:global(.epd-dialog.component-changelog-dialog) {
  overflow: hidden;
  border-radius: 6px;
}

:global(.epd-dialog.component-changelog-dialog .epd-dialog__header) {
  margin: 0;
  padding: 18px 20px;
  border-bottom: 1px solid var(--ep-docs-mx-border-light);
}

:global(.epd-dialog.component-changelog-dialog .epd-dialog__body) {
  padding: 0;
}

.component-changelog-dialog-header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.component-changelog-dialog-header .epd-dialog__title {
  min-width: 0;
  color: var(--ep-docs-text-color);
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
  overflow-wrap: anywhere;
}

.component-changelog-dialog-close {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ep-docs-text-color-lighter);
  cursor: pointer;
}

.component-changelog-dialog-close:hover,
.component-changelog-dialog-close:focus-visible {
  background: var(--ep-docs-mx-fill);
  color: var(--ep-docs-brand-color);
  outline: none;
}

.component-changelog-dialog-scroll {
  max-height: min(65vh, 620px);
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

:global(.epd-dialog.component-changelog-dialog .component-commit-timeline) {
  margin: 0 !important;
}

@media (max-width: 639px) {

  .component-doc-links {
    flex-wrap: wrap;
    row-gap: 8px;
  }
}

</style>
