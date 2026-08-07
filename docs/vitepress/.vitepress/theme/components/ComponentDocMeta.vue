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
  X,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { formatDocsMessage } from '../../docs-i18n'
import { docsSite, componentSourcePath as getComponentSourcePath, getDocsLocaleConfig } from '../../docs-site'
import { getComponentGithubMetadata, githubMetadata } from '../../github-metadata'
import { useDocsLocale } from '../use-docs-locale'
import ComponentCommitTimeline from './ComponentCommitTimeline.vue'

const props = defineProps<{
  name: string
  slug: string
  hasSourceDoc: boolean
}>()

const { link, locale, messages } = useDocsLocale()
const changelogVisible = ref(false)

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
const changelogTitle = computed(() => formatDocsMessage(messages.value.changelog.aria, { name: props.name }))
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
              <HeadlessCopyText :text="importStatement" :reset-delay="1600">
                <template #default="{ copied, copying, copy }">
                  <button
                    class="component-doc-import-copy"
                    type="button"
                    :disabled="copying"
                    :title="copied ? messages.meta.copied : messages.meta.copyImport"
                    :aria-label="copied ? messages.meta.copied : messages.meta.copyImport"
                    @click="copy().catch(() => undefined)"
                  >
                    <code>{{ importStatement }}</code>
                    <Check v-if="copied" class="component-doc-copy-status" :size="14" aria-hidden="true" />
                  </button>
                </template>
              </HeadlessCopyText>
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
              <button
                type="button"
                aria-haspopup="dialog"
                :aria-expanded="changelogVisible"
                @click="changelogVisible = true"
              >
                <History :size="14" aria-hidden="true" />
                {{ messages.meta.changelog }}
                <span class="component-doc-count">{{ commitCount }}</span>
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
          <ComponentCommitTimeline :name="name" />
        </div>
      </ElDialog>
    </ClientOnly>
  </div>
</template>
