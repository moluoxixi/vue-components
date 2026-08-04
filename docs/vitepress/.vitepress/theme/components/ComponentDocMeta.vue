<script setup lang="ts">
import {
  Check,
  CircleDot,
  FilePenLine,
  FolderGit2,
  ListTodo,
  MessageSquareWarning,
  PanelsTopLeft,
} from '@lucide/vue'
import { copyText } from '@moluoxixi/components'
import { withBase } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  name: string
  slug: string
  hasSourceDoc: boolean
}>()

const repositoryUrl = 'https://github.com/moluoxixi/vue-components'
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const importStatement = computed(() => `import { ${props.name} } from '@moluoxixi/components';`)
const componentSourcePath = computed(() => `packages/components/src/${props.name}`)
const sourceHref = computed(() => `${repositoryUrl}/tree/main/${componentSourcePath.value}`)
const newIssueHref = computed(() => `${repositoryUrl}/issues/new?title=${encodeURIComponent(`[${props.name}] `)}`)
const openIssuesHref = computed(() => `${repositoryUrl}/issues?q=${encodeURIComponent(`is:issue is:open ${props.name}`)}`)
const editHref = computed(() => props.hasSourceDoc
  ? `${repositoryUrl}/edit/main/${componentSourcePath.value}/docs/index.md`
  : sourceHref.value)
const overviewHref = withBase('/components/')

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
  <div class="component-doc-meta" aria-label="组件文档信息">
    <table class="component-doc-meta-table">
      <tbody>
        <tr>
          <th scope="row">
            使用
          </th>
          <td>
            <div class="component-doc-import">
              <button
                class="component-doc-import-copy"
                type="button"
                :title="copied ? '已复制' : '复制导入语句'"
                :aria-label="copied ? '已复制导入语句' : '复制导入语句'"
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
            反馈
          </th>
          <td>
            <div class="component-doc-links">
              <a :href="sourceHref" target="_blank" rel="noreferrer">
                <FolderGit2 :size="14" aria-hidden="true" />
                components/{{ slug }}
              </a>
              <a :href="newIssueHref" target="_blank" rel="noreferrer">
                <MessageSquareWarning :size="14" aria-hidden="true" />
                提交问题
              </a>
              <a :href="openIssuesHref" target="_blank" rel="noreferrer">
                <ListTodo :size="14" aria-hidden="true" />
                待解决
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <th scope="row">
            文档
          </th>
          <td>
            <div class="component-doc-links">
              <a :href="editHref" target="_blank" rel="noreferrer">
                <FilePenLine :size="14" aria-hidden="true" />
                {{ hasSourceDoc ? '编辑此页' : '补充文档' }}
              </a>
              <a :href="overviewHref">
                <PanelsTopLeft :size="14" aria-hidden="true" />
                组件总览
              </a>
              <a href="#api">
                <CircleDot :size="14" aria-hidden="true" />
                API
              </a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
