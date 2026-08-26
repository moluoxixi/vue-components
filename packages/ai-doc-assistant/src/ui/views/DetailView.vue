<script setup lang="ts">
/**
 * 详情视图：单组件完整契约。
 * 挂载 / name 变化时拉取 GET /components/:name，分区渲染 props / emits / slots /
 * v-model 表格与展开的关联自定义类型（typeDefs）。props 的 typeRefs 高亮，
 * 指引用户到下方类型定义区查字段结构（方案 A 成果的可视化呈现）。
 */
import { ArrowLeft, Download, MessageSquare } from '@lucide/vue'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { computed, ref, useTemplateRef, watch } from 'vue'
import type { ComponentDetailResponse } from '../../shared/protocol'
import { fetchComponentDetail } from '../api'
import { exportComponentDetail, KNOWLEDGE_EXPORT_FORMATS, type KnowledgeExportFormat } from '../export'
import TypeReference from '../components/TypeReference.vue'
import { restoreFocusIfLost } from '../focus'

const props = defineProps<{ name: string }>()
const emit = defineEmits<{ (e: 'back'): void, (e: 'ask', name: string): void }>()

/** 当前组件详情；null 表示加载中或失败。 */
const detail = ref<ComponentDetailResponse | null>(null)
/** 错误信息。 */
const errorMsg = ref('')
/** 加载中标志。 */
const loading = ref(false)
const exportingFormat = ref<KnowledgeExportFormat | ''>('')
const exportTrigger = useTemplateRef<HTMLButtonElement>('exportTrigger')
let loadRequestId = 0

/** 按类型名索引展开后的类型定义，供 prop type tooltip 快速查找。 */
const typeDefByName = computed(() => new Map((detail.value?.typeDefs ?? []).map(t => [t.name, t] as const)))

/** 预编译当前详情的本地类型名匹配器，避免表格每个单元格重复构造 RegExp。 */
const typeDefMatchers = computed(() => (detail.value?.typeDefs ?? []).map((typeDef) => {
  const escaped = typeDef.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { name: typeDef.name, pattern: new RegExp(`\\b${escaped}\\b`) }
}))

const detailSections = computed(() => {
  const value = detail.value
  if (!value)
    return []
  return [
    { id: 'detail-props-section', label: 'Props', visible: value.props.length > 0 },
    { id: 'detail-emits-section', label: 'Emits', visible: value.emits.length > 0 },
    { id: 'detail-models-section', label: 'v-model', visible: value.models.length > 0 },
    { id: 'detail-slots-section', label: 'Slots', visible: value.slots.length > 0 },
    { id: 'detail-attrs-section', label: '$attrs', visible: Boolean(value.attrs?.length) },
    { id: 'detail-exposed-section', label: 'Exposed', visible: Boolean(value.exposed?.length) },
    { id: 'detail-typedefs-section', label: '类型定义', visible: value.typeDefs.length > 0 },
  ].filter(section => section.visible)
})

/** 把 prop 引用的类型定义格式化为 tooltip 文案。 */
function typeTooltipContent(typeRefs: string[]): string {
  return typeRefs
    .map((name) => {
      const typeDef = typeDefByName.value.get(name)
      if (!typeDef)
        return name
      if (!typeDef.fields.length)
        return `${typeDef.name}\n${typeDef.raw}`
      const fields = typeDef.fields.map((field) => {
        const requiredText = field.optional ? '可选' : '必填'
        const description = field.description ? ` ${field.description}` : ''
        return `${field.name}: ${field.type}（${requiredText}）${description}`
      })
      return [typeDef.name, ...fields].join('\n')
    })
    .join('\n\n')
}

/**
 * 从任意契约类型文本中解析当前详情已展开的本地类型引用。
 *
 * props / emits / slots / exposed 由后端显式给出 typeRefs；v-model、attrs 以及关联类型定义字段
 * 只有类型字符串。这里按当前 detail.typeDefs 兜底匹配，避免这些表格里的 `PopoverTableRow`、
 * `PopoverTableColumn` 等本地类型只显示名称却没有 tooltip 明细。
 */
function typeRefsForDisplay(typeText: string, explicitRefs: string[] = []): string[] {
  const refs = new Set(explicitRefs)
  for (const { name, pattern } of typeDefMatchers.value) {
    if (pattern.test(typeText))
      refs.add(name)
  }
  return Array.from(refs)
}

/** 当前类型文本是否能展示本地类型 tooltip。 */
function hasTypeTooltip(typeText: string, explicitRefs: string[] = []): boolean {
  return typeRefsForDisplay(typeText, explicitRefs).length > 0
}

/** 拉取指定组件的契约详情。 */
async function load(name: string): Promise<void> {
  const requestId = ++loadRequestId
  loading.value = true
  errorMsg.value = ''
  detail.value = null
  try {
    const nextDetail = await fetchComponentDetail(name)
    if (requestId === loadRequestId)
      detail.value = nextDetail
  }
  catch (err) {
    if (requestId === loadRequestId)
      errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    if (requestId === loadRequestId)
      loading.value = false
  }
}

function exportCurrentDetail(format: KnowledgeExportFormat): void {
  if (!detail.value)
    return
  exportingFormat.value = format
  try {
    exportComponentDetail(detail.value, format)
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    exportingFormat.value = ''
  }
}

function onExportCommand(format: KnowledgeExportFormat): void {
  exportCurrentDetail(format)
}

function onExportVisibleChange(visible: boolean): void {
  if (!visible)
    restoreFocusIfLost(exportTrigger.value)
}

function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(() => props.name, load, { immediate: true })
</script>

<template>
  <div class="detail" data-testid="detail-view">
    <div class="detail-head">
      <button class="link-btn" type="button" data-testid="detail-back" @click="emit('back')">
        <ArrowLeft :size="15" />
        返回总览
      </button>
      <div v-if="detail" class="detail-actions">
        <ElDropdown trigger="click" :teleported="false" @command="onExportCommand" @visible-change="onExportVisibleChange">
          <button ref="exportTrigger" class="export-button" type="button" data-testid="detail-export-trigger">
            <Download :size="15" />
            导出
          </button>
          <template #dropdown>
            <ElDropdownMenu data-testid="detail-export-menu">
              <ElDropdownItem
              v-for="format in KNOWLEDGE_EXPORT_FORMATS"
              :key="format.id"
              :command="format.id"
              :disabled="exportingFormat === format.id"
              data-testid="detail-export-option"
            >
                {{ format.label }}
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
        <button
          class="link-btn ask"
          type="button"
          data-testid="detail-ask"
          @click="emit('ask', detail.name)"
        >
          <MessageSquare :size="15" />
          问 AI 这个组件
        </button>
      </div>
    </div>

    <div v-if="loading" class="hint" data-testid="detail-loading">
      加载中…
    </div>
    <div v-else-if="errorMsg" class="hint error" role="alert" data-testid="detail-error">
      <span>{{ errorMsg }}</span>
      <button class="link-btn retry" type="button" data-testid="detail-retry" @click="load(name)">
        重试
      </button>
    </div>

    <template v-else-if="detail">
      <h2 class="comp-title" data-testid="detail-title">
        {{ detail.name }}
        <small>{{ detail.packageName }}</small>
        <span v-if="detail.source === 'external'" class="source-badge">外部知识库</span>
      </h2>
      <p v-if="detail.description" class="desc">
        {{ detail.description }}
      </p>

      <div class="detail-layout">
        <nav class="section-nav" aria-label="组件契约区块" data-testid="detail-nav">
          <button
            v-for="section in detailSections"
            :key="section.id"
            type="button"
            @click="scrollToSection(section.id)"
          >
            {{ section.label }}
          </button>
        </nav>
        <div class="detail-sections">
      <section id="detail-props-section" v-if="detail.props.length" data-testid="detail-props">
        <h3>Props</h3>
        <table class="contract-table">
          <thead>
            <tr><th>名称</th><th>类型</th><th>必填</th><th>默认值</th><th>说明</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in detail.props" :key="p.name" data-testid="prop-row">
              <td>
                <code>{{ p.name }}</code>
                <span
                  v-if="p.forwardedFrom"
                  class="forwarded-badge"
                  :title="`透传自内部组件 ${p.forwardedFrom}`"
                  data-testid="prop-forwarded"
                >透传自 {{ p.forwardedFrom }}</span>
              </td>
              <td>
                <TypeReference
                  v-if="hasTypeTooltip(p.type, p.typeRefs)"
                  :text="p.type"
                  :content="typeTooltipContent(typeRefsForDisplay(p.type, p.typeRefs))"
                />
                <code v-else>{{ p.type }}</code>
              </td>
              <td>{{ p.required ? '是' : '否' }}</td>
              <td><code v-if="p.defaultValue">{{ p.defaultValue }}</code><span v-else>—</span></td>
              <td>{{ p.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="detail-emits-section" v-if="detail.emits.length" data-testid="detail-emits">
        <h3>Emits</h3>
        <table class="contract-table">
          <thead><tr><th>事件</th><th>载荷类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="e in detail.emits" :key="e.name">
              <td><code>{{ e.name }}</code></td>
              <td>
                <TypeReference
                  v-if="hasTypeTooltip(e.payloadType, e.typeRefs)"
                  :text="e.payloadType"
                  :content="typeTooltipContent(typeRefsForDisplay(e.payloadType, e.typeRefs))"
                />
                <code v-else>{{ e.payloadType }}</code>
              </td>
              <td>{{ e.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="detail-models-section" v-if="detail.models.length" data-testid="detail-models">
        <h3>v-model</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>类型</th></tr></thead>
          <tbody>
            <tr v-for="m in detail.models" :key="m.name">
              <td><code>{{ m.name }}</code></td>
              <td>
                <TypeReference
                  v-if="hasTypeTooltip(m.type)"
                  :text="m.type"
                  :content="typeTooltipContent(typeRefsForDisplay(m.type))"
                />
                <code v-else>{{ m.type }}</code>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="detail-slots-section" v-if="detail.slots.length" data-testid="detail-slots">
        <h3>Slots</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>作用域类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="s in detail.slots" :key="s.name">
              <td><code>{{ s.name }}</code></td>
              <td>
                <TypeReference
                  v-if="hasTypeTooltip(s.scopeType, s.typeRefs)"
                  :text="s.scopeType"
                  :content="typeTooltipContent(typeRefsForDisplay(s.scopeType, s.typeRefs))"
                />
                <code v-else>{{ s.scopeType }}</code>
              </td>
              <td>{{ s.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="detail-attrs-section" v-if="detail.attrs && detail.attrs.length" data-testid="detail-attrs">
        <h3>透传属性（$attrs）</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>类型</th><th>可选</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="a in detail.attrs" :key="a.name" data-testid="attr-row">
              <td><code>{{ a.name }}</code></td>
              <td>
                <TypeReference
                  v-if="hasTypeTooltip(a.type)"
                  :text="a.type"
                  :content="typeTooltipContent(typeRefsForDisplay(a.type))"
                />
                <code v-else>{{ a.type }}</code>
              </td>
              <td>{{ a.optional ? '是' : '否' }}</td>
              <td>{{ a.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="detail-exposed-section" v-if="detail.exposed && detail.exposed.length" data-testid="detail-exposed">
        <h3>对外暴露（defineExpose）</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="e in detail.exposed" :key="e.name" data-testid="expose-row">
              <td><code>{{ e.name }}</code></td>
              <td>
                <TypeReference
                  v-if="hasTypeTooltip(e.type, e.typeRefs)"
                  :text="e.type"
                  :content="typeTooltipContent(typeRefsForDisplay(e.type, e.typeRefs))"
                />
                <code v-else>{{ e.type }}</code>
              </td>
              <td>{{ e.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="detail-typedefs-section" v-if="detail.typeDefs.length" data-testid="detail-typedefs">
        <h3>关联类型定义</h3>
        <div v-for="t in detail.typeDefs" :key="t.name" class="typedef" data-testid="typedef-block">
          <div class="typedef-name">
            <code>{{ t.name }}</code><small>{{ t.kind }}</small>
          </div>
          <table v-if="t.fields.length" class="contract-table">
            <thead><tr><th>字段</th><th>类型</th><th>可选</th><th>说明</th></tr></thead>
            <tbody>
              <tr v-for="f in t.fields" :key="f.name">
                <td><code>{{ f.name }}</code></td>
                <td>
                  <TypeReference
                    v-if="hasTypeTooltip(f.type)"
                    :text="f.type"
                    :content="typeTooltipContent(typeRefsForDisplay(f.type))"
                  />
                  <code v-else>{{ f.type }}</code>
                </td>
                <td>{{ f.optional ? '是' : '否' }}</td>
                <td>{{ f.description || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail { box-sizing: border-box; width: min(100%, 1240px); min-height: 100%; margin: 0 auto; padding: 24px; overflow-x: hidden; }
.detail-head { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.detail-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.export-button {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 6px;
  background: #f6f8fa; color: #1f2328; cursor: pointer; font-size: 12px;
}
.export-button:hover { border-color: #1f6feb; background: #ddf4ff; }
.export-button:disabled { opacity: .5; cursor: wait; }
.link-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: none; color: #1f6feb; cursor: pointer;
  font-size: 13px; padding: 4px 0;
}
.link-btn.ask { color: #238636; }
.hint { color: #57606a; padding: 30px 0; }
.hint.error { display: flex; align-items: center; gap: 10px; color: #cf222e; }
.link-btn.retry { color: #cf222e; text-decoration: underline; }
.comp-title { font-size: 22px; margin: 0 0 4px; }
.comp-title small { font-size: 13px; color: #8b949e; font-weight: 400; margin-left: 8px; }
.source-badge {
  margin-left: 8px; font-size: 12px; color: #8250df; background: #fbefff;
  padding: 2px 8px; border-radius: 999px; vertical-align: middle;
}
.desc { color: #57606a; margin: 0 0 18px; }
.detail-layout { display: grid; grid-template-columns: 148px minmax(0, 1fr); align-items: start; gap: 24px; }
.section-nav {
  position: sticky; top: 16px;
  display: grid; gap: 3px; padding: 6px;
  border: 1px solid #dfe3e8; border-radius: 7px; background: #fff;
}
.section-nav button {
  padding: 7px 9px; border: 0; border-radius: 5px; background: transparent;
  color: #59636e; cursor: pointer; font-size: 12px; text-align: left;
}
.section-nav button:hover,
.section-nav button:focus-visible { background: #eef4fb; color: #0969da; outline: none; }
.detail-sections { min-width: 0; }
section { scroll-margin-top: 16px; margin-bottom: 24px; overflow-x: auto; }
section h3 { font-size: 14px; color: #1f2328; margin: 0 0 10px; }
.contract-table {
  width: 100%; min-width: 640px; border-collapse: collapse; font-size: 13px;
  border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden;
}
.contract-table th, .contract-table td {
  text-align: left; padding: 8px 12px; border-bottom: 1px solid #eaeef2;
}
.contract-table th { background: #f6f8fa; color: #57606a; font-weight: 600; }
.contract-table tr:last-child td { border-bottom: none; }
code {
  font-family: ui-monospace, monospace; font-size: 12px;
  background: #f6f8fa; padding: 1px 6px; border-radius: 4px;
}
code.ref,
code.type-ref { background: #ddf4ff; color: #0969da; }
.forwarded-badge {
  display: inline-block; margin-left: 6px; font-size: 11px;
  color: #6e40c9; background: #f3eefb; border: 1px solid #e0d3f5;
  padding: 0 6px; border-radius: 10px; vertical-align: middle;
}
.typedef { margin-bottom: 16px; }
.typedef-name { margin-bottom: 6px; }
.typedef-name small { color: #8b949e; margin-left: 8px; font-size: 11px; }

@media (max-width: 760px) {
  .detail { padding: 16px 12px; }
  .detail-head { align-items: flex-start; flex-direction: column; }
  .detail-actions { width: 100%; justify-content: flex-start; }
  .comp-title { font-size: 19px; }
  .comp-title small,
  .source-badge { display: block; width: fit-content; margin: 5px 0 0; }
  .detail-layout { display: block; }
  .section-nav {
    position: sticky; top: 0; z-index: 2;
    display: flex; margin-bottom: 16px; overflow-x: auto;
    border-right: 0; border-left: 0; border-radius: 0;
    white-space: nowrap;
  }
  .section-nav button { flex: 0 0 auto; }
}
</style>
