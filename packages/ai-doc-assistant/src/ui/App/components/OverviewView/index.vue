<script setup lang="ts">
/**
 * Overview 视图：组件总览。
 * 顶部搜索框按名称/包名实时过滤，下方卡片网格展示每个组件的 props 数量。
 * 点击卡片 emit('open', name) 由父级切到详情视图；卡片右上角导出图标按格式导出当前组件契约。
 */
import { Download } from '@lucide/vue'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { computed, ref, shallowRef } from 'vue'
import type { ComponentListItem } from '../../../../shared/protocol'
import { fetchComponentDetail } from '../../../api'
import { exportComponentDetail, KNOWLEDGE_EXPORT_FORMATS, type KnowledgeExportFormat } from '../../../export'
import { restoreFocusIfLost } from '../../../focus'

const props = withDefaults(defineProps<{ components: ComponentListItem[], loading?: boolean, error?: string }>(), {
  loading: false,
  error: '',
})
const emit = defineEmits<{ (e: 'open', name: string): void, (e: 'retry'): void }>()

/** 搜索关键字（名称/包名子串，不区分大小写）。 */
const keyword = ref('')
const exportingKey = ref('')
const errorMsg = ref('')
const lastExportTrigger = shallowRef<HTMLElement | null>(null)

/** 过滤后的组件列表。 */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw)
    return props.components
  return props.components.filter(c =>
    c.name.toLowerCase().includes(kw) || c.packageName.toLowerCase().includes(kw),
  )
})

async function exportComponent(name: string, format: KnowledgeExportFormat): Promise<void> {
  exportingKey.value = `${name}:${format}`
  errorMsg.value = ''
  try {
    const detail = await fetchComponentDetail(name)
    exportComponentDetail(detail, format)
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    exportingKey.value = ''
  }
}

function onExportCommand(name: string, format: KnowledgeExportFormat): void {
  void exportComponent(name, format)
}

function rememberExportTrigger(event: Event): void {
  lastExportTrigger.value = event.currentTarget as HTMLElement
}

function onExportVisibleChange(visible: boolean): void {
  if (!visible)
    restoreFocusIfLost(lastExportTrigger.value)
}
</script>

<template>
  <div class="overview" data-testid="overview-view">
    <div class="search-row">
      <input
        v-model="keyword"
        type="search"
        aria-label="搜索组件名或包名"
        class="search-input"
        data-testid="overview-search"
        placeholder="搜索组件名或包名…"
      >
      <span class="count" data-testid="overview-count">{{ filtered.length }} / {{ components.length }}</span>
    </div>

    <div v-if="errorMsg" class="overview-error" role="alert" data-testid="overview-export-error">
      {{ errorMsg }}
    </div>

    <div v-if="loading" class="empty" role="status" data-testid="overview-loading">
      正在加载组件契约…
    </div>
    <div v-else-if="error" class="empty error" role="alert" data-testid="overview-error">
      <span>{{ error }}</span>
      <button type="button" data-testid="overview-retry" @click="emit('retry')">重试</button>
    </div>
    <div v-else-if="!filtered.length" class="empty" data-testid="overview-empty">
      {{ components.length ? '没有匹配的组件' : '知识库中还没有组件' }}
    </div>

    <div v-else class="card-grid">
      <article
        v-for="c in filtered"
        :key="c.knowledgeKey ?? c.packageName + c.name"
        class="card"
        data-testid="component-card"
      >
        <button
          class="card-open"
          type="button"
          :aria-label="`查看 ${c.name} 组件契约`"
          data-testid="component-open"
          @click="emit('open', c.knowledgeKey ?? c.name)"
        >
          <strong class="card-name">{{ c.name }}</strong>
          <small class="card-pkg">{{ c.packageName }}</small>
          <span class="card-props">{{ c.propsCount }} props</span>
          <span v-if="c.source === 'external'" class="source-badge">外部</span>
        </button>
        <span class="card-export-actions" aria-label="导出组件契约" @click.stop>
          <ElDropdown
            trigger="click"
            :teleported="false"
            @command="onExportCommand(c.knowledgeKey ?? c.name, $event)"
            @visible-change="onExportVisibleChange"
          >
            <button
              class="export-icon"
              type="button"
              title="导出组件契约"
              :aria-label="`导出 ${c.name}`"
              data-testid="card-export-trigger"
              @focus="rememberExportTrigger"
              @click.stop="rememberExportTrigger"
            >
              <Download :size="15" />
            </button>
            <template #dropdown>
              <ElDropdownMenu data-testid="card-export-menu">
                <ElDropdownItem
              v-for="format in KNOWLEDGE_EXPORT_FORMATS"
              :key="format.id"
              :command="format.id"
              :disabled="exportingKey === `${c.knowledgeKey ?? c.name}:${format.id}`"
              data-testid="card-export-option"
            >
                  {{ format.label }}
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </span>
      </article>
    </div>
  </div>
</template>

<style scoped>
.overview { box-sizing: border-box; width: min(100%, 1240px); min-height: 100%; margin: 0 auto; padding: 24px; }
.search-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.search-input {
  flex: 1; padding: 10px 14px; border: 1px solid #d0d7de;
  border-radius: 8px; font-size: 14px;
}
.count { font-size: 13px; color: #57606a; white-space: nowrap; }
.empty { display: grid; min-height: 220px; place-content: center; justify-items: center; gap: 10px; color: #57606a; font-size: 14px; text-align: center; }
.empty.error { color: #cf222e; }
.empty button { padding: 6px 10px; border: 1px solid currentColor; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.overview-error {
  margin-bottom: 12px; padding: 8px 10px; border: 1px solid #ffccc7; border-radius: 6px;
  background: #ffebe9; color: #cf222e; font-size: 13px;
}
.card-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 14px;
}
.card {
  position: relative;
  min-height: 112px; border: 1px solid #d0d7de; border-radius: 8px;
  background: #fff; transition: all .15s;
}
.card:hover,
.card:focus-within { border-color: #1f6feb; box-shadow: 0 2px 8px rgba(31,111,235,.12); }
.card-open {
  display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
  width: 100%; min-height: 110px; padding: 16px; border: 0; border-radius: 7px;
  background: transparent; color: inherit; cursor: pointer; text-align: left;
}
.card-open:focus-visible { outline: 2px solid #409eff; outline-offset: -2px; }
.card-export-actions {
  position: absolute; top: 10px; right: 10px;
  display: flex; gap: 4px;
}
.export-icon {
  display: grid; width: 30px; height: 30px; padding: 0; place-items: center;
  border: 1px solid transparent; border-radius: 6px;
  background: #f6f8fa; color: #59636e; cursor: pointer; line-height: 1;
}
.export-icon:hover { border-color: #1f6feb; background: #ddf4ff; }
.export-icon:disabled { opacity: .5; cursor: wait; }
.card-name { padding-right: 90px; font-size: 15px; color: #1f2328; }
.card-pkg { font-size: 11px; color: #8b949e; }
.card-props {
  margin-top: 4px; font-size: 12px; color: #1f6feb;
  background: #ddf4ff; padding: 2px 8px; border-radius: 999px;
}
.source-badge {
  font-size: 11px; color: #8250df; background: #fbefff; padding: 2px 8px; border-radius: 999px;
}

@media (max-width: 640px) {
  .overview { padding: 16px 12px; }
  .search-row { align-items: stretch; flex-direction: column; gap: 8px; }
  .count { align-self: flex-end; }
  .card-name { padding-right: 42px; }
  .export-icon { width: 36px; height: 36px; }
}
</style>
