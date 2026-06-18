<script setup lang="ts">
/**
 * Overview 视图：组件总览。
 * 顶部搜索框按名称/包名实时过滤，下方卡片网格展示每个组件的 props 数量。
 * 点击卡片 emit('open', name) 由父级切到详情视图；卡片右上角导出图标按格式导出当前组件契约。
 */
import { computed, ref } from 'vue'
import type { ComponentListItem } from '../../shared/protocol'
import { fetchComponentDetail } from '../api'
import { exportComponentDetail, KNOWLEDGE_EXPORT_FORMATS, preparePdfExport, type KnowledgeExportFormat } from '../export'

const props = defineProps<{ components: ComponentListItem[] }>()
const emit = defineEmits<{ (e: 'open', name: string): void }>()

/** 搜索关键字（名称/包名子串，不区分大小写）。 */
const keyword = ref('')
const exportingKey = ref('')
const errorMsg = ref('')

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
  const key = `${name}:${format}`
  const preparedPdf = format === 'pdf' ? preparePdfExport() : null
  exportingKey.value = key
  errorMsg.value = ''
  try {
    const detail = await fetchComponentDetail(name)
    if (preparedPdf)
      preparedPdf.fill(detail)
    else
      exportComponentDetail(detail, format)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errorMsg.value = message
    preparedPdf?.fail(message)
  }
  finally {
    exportingKey.value = ''
  }
}
</script>

<template>
  <div class="overview" data-testid="overview-view">
    <div class="search-row">
      <input
        v-model="keyword"
        class="search-input"
        data-testid="overview-search"
        placeholder="搜索组件名或包名…"
      >
      <span class="count" data-testid="overview-count">{{ filtered.length }} / {{ components.length }}</span>
    </div>

    <div v-if="errorMsg" class="overview-error" data-testid="overview-export-error">
      {{ errorMsg }}
    </div>

    <div v-if="!filtered.length" class="empty" data-testid="overview-empty">
      没有匹配的组件
    </div>

    <div class="card-grid">
      <article
        v-for="c in filtered"
        :key="c.packageName + c.name"
        class="card"
        role="button"
        tabindex="0"
        data-testid="component-card"
        @click="emit('open', c.name)"
        @keydown.enter.prevent="emit('open', c.name)"
        @keydown.space.prevent="emit('open', c.name)"
      >
        <span class="card-export-actions" aria-label="导出组件契约">
          <button
            v-for="format in KNOWLEDGE_EXPORT_FORMATS"
            :key="format.id"
            class="export-icon"
            type="button"
            :title="`导出 ${format.label}`"
            :aria-label="`导出 ${c.name} ${format.label}`"
            :disabled="exportingKey === `${c.name}:${format.id}`"
            data-testid="card-export-btn"
            @click.stop="exportComponent(c.name, format.id)"
          >
            {{ format.icon }}
          </button>
        </span>
        <strong class="card-name">{{ c.name }}</strong>
        <small class="card-pkg">{{ c.packageName }}</small>
        <span class="card-props">{{ c.propsCount }} props</span>
      </article>
    </div>
  </div>
</template>

<style scoped>
.overview { padding: 20px; }
.search-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.search-input {
  flex: 1; padding: 10px 14px; border: 1px solid #d0d7de;
  border-radius: 8px; font-size: 14px;
}
.count { font-size: 13px; color: #57606a; white-space: nowrap; }
.empty { color: #57606a; font-size: 14px; padding: 40px 0; text-align: center; }
.overview-error {
  margin-bottom: 12px; padding: 8px 10px; border: 1px solid #ffccc7; border-radius: 6px;
  background: #ffebe9; color: #cf222e; font-size: 13px;
}
.card-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.card {
  position: relative;
  display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
  padding: 16px; border: 1px solid #d0d7de; border-radius: 10px;
  background: #fff; cursor: pointer; text-align: left; transition: all .15s;
}
.card:hover { border-color: #1f6feb; box-shadow: 0 2px 8px rgba(31,111,235,.12); }
.card-export-actions {
  position: absolute; top: 10px; right: 10px;
  display: flex; gap: 4px;
}
.export-icon {
  width: 26px; height: 26px; border: 1px solid transparent; border-radius: 6px;
  background: #f6f8fa; cursor: pointer; line-height: 1; font-size: 14px;
}
.export-icon:hover { border-color: #1f6feb; background: #ddf4ff; }
.export-icon:disabled { opacity: .5; cursor: wait; }
.card-name { padding-right: 90px; font-size: 15px; color: #1f2328; }
.card-pkg { font-size: 11px; color: #8b949e; }
.card-props {
  margin-top: 4px; font-size: 12px; color: #1f6feb;
  background: #ddf4ff; padding: 2px 8px; border-radius: 999px;
}
</style>
