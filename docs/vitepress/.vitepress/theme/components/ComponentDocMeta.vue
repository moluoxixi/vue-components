<script setup lang="ts">
import {
  Check,
  CircleDot,
  FilePenLine,
  FolderGit2,
  History,
  ListTodo,
  MessageSquareWarning,
  PanelsTopLeft,
} from '@lucide/vue'
import { copyText } from '@docs-components'
import { computed, onBeforeUnmount, ref } from 'vue'
import { docsSite, componentSourcePath as getComponentSourcePath, getDocsLocaleConfig } from '../../docs-site'
import { getComponentGithubMetadata, githubMetadata } from '../../github-metadata'
import { useDocsLocale } from '../use-docs-locale'

const props = defineProps<{
  name: string
  slug: string
  hasSourceDoc: boolean
}>()

const { link, locale, messages } = useDocsLocale()
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const componentMetadata = computed(() => getComponentGithubMetadata(props.name))
const importStatement = computed(() => `import { ${props.name} } from '${docsSite.packageName}';`)
const componentSourcePath = computed(() => getComponentSourcePath(props.name))
const sourceHref = computed(() => `${docsSite.repository.url}/tree/${githubMetadata.repository.defaultBranch}/${componentSourcePath.value}`)
const newIssueHref = computed(() => `${docsSite.repository.url}/issues/new?title=${encodeURIComponent(`${docsSite.github.issueTitlePrefix(props.name)} `)}`)
const openIssuesHref = computed(() => `${docsSite.repository.url}/issues?q=${encodeURIComponent(`is:issue is:open in:title "${docsSite.github.issueTitlePrefix(props.name)}"`)}`)
const editHref = computed(() => props.hasSourceDoc
  ? `${docsSite.repository.url}/edit/${githubMetadata.repository.defaultBranch}/${componentSourcePath.value}/${getDocsLocaleConfig(locale.value).sourceDoc}`
  : sourceHref.value)
const overviewHref = computed(() => link(docsSite.routes.components))
const openIssueCount = computed(() => componentMetadata.value.openIssueCount)
const commitCount = computed(() => componentMetadata.value.commits.length)

async function copyImportStatement() {
  await copyText(importStatement.value)
  copied.value = true
  if (copiedTimer)
    clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1600)
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
          <th scope="row">
            {{ messages.meta.usage }}
          </th>
          <td>
            <div class="component-doc-import">
              <button
                class="component-doc-import-copy"
                type="button"
                :title="copied ? messages.meta.copied : messages.meta.copyImport"
                :aria-label="copied ? messages.meta.copied : messages.meta.copyImport"
                @click="copyImportStatement"
              >
                <code>{{ importStatement }}</code>
                <Check v-if="copied" class="component-doc-copy-status" :size="14" aria-hidden="true" />
              </button>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row">
            {{ messages.meta.feedback }}
          </th>
          <td>
            <div class="component-doc-links">
              <a :href="sourceHref" target="_blank" rel="noreferrer">
                <FolderGit2 :size="14" aria-hidden="true" />
                components/{{ slug }}
              </a>
              <a :href="newIssueHref" target="_blank" rel="noreferrer">
                <MessageSquareWarning :size="14" aria-hidden="true" />
                {{ messages.meta.submitIssue }}
              </a>
              <a :href="openIssuesHref" target="_blank" rel="noreferrer">
                <ListTodo :size="14" aria-hidden="true" />
                {{ messages.meta.openIssues }}
                <span class="component-doc-count">{{ openIssueCount }}</span>
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row">
            {{ messages.meta.documentation }}
          </th>
          <td>
            <div class="component-doc-links">
              <a :href="editHref" target="_blank" rel="noreferrer">
                <FilePenLine :size="14" aria-hidden="true" />
                {{ hasSourceDoc ? messages.meta.editPage : messages.meta.addDocs }}
              </a>
              <a :href="overviewHref">
                <PanelsTopLeft :size="14" aria-hidden="true" />
                {{ messages.meta.componentOverview }}
              </a>
              <a href="#api">
                <CircleDot :size="14" aria-hidden="true" />
                {{ messages.route.api }}
              </a>
              <a href="#changelog">
                <History :size="14" aria-hidden="true" />
                {{ messages.meta.changelog }}
                <span class="component-doc-count">{{ commitCount }}</span>
              </a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
