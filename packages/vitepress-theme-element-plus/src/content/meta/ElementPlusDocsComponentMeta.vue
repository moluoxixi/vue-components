<script setup lang="ts">
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
</script>

<template>
  <div class="component-doc-meta" :aria-label="messages.meta.aria">
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
        <tr>
          <th scope="row">{{ messages.meta.feedback }}</th>
          <td>
            <div class="component-doc-links">
              <a :href="data.sourceHref" target="_blank" rel="noreferrer">
                <FolderGit2 :size="14" aria-hidden="true" />
                {{ data.sourceLabel }}
              </a>
              <a :href="data.newIssueHref" target="_blank" rel="noreferrer">
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
              <a :href="data.editHref" target="_blank" rel="noreferrer">
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
