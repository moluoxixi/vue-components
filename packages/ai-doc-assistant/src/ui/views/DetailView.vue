<script setup lang="ts">
/**
 * 详情视图：单组件完整契约。
 * 挂载 / name 变化时拉取 GET /components/:name，分区渲染 props / emits / slots /
 * v-model 表格与展开的关联自定义类型（typeDefs）。props 的 typeRefs 高亮，
 * 指引用户到下方类型定义区查字段结构（方案 A 成果的可视化呈现）。
 */
import { computed, ref, watch } from 'vue'
import type { ComponentDetailResponse } from '../../shared/protocol'
import { fetchComponentDetail } from '../api'
import { exportComponentDetail, KNOWLEDGE_EXPORT_FORMATS, type KnowledgeExportFormat } from '../export'

const props = defineProps<{ name: string }>()
const emit = defineEmits<{ (e: 'back'): void, (e: 'ask', name: string): void }>()

/** 当前组件详情；null 表示加载中或失败。 */
const detail = ref<ComponentDetailResponse | null>(null)
/** 错误信息。 */
const errorMsg = ref('')
/** 加载中标志。 */
const loading = ref(false)
const exportingFormat = ref<KnowledgeExportFormat | ''>('')
/** Tooltip 内容样式：保留字段换行，避免复杂类型挤成一行。 */
const typeTooltipStyle = { whiteSpace: 'pre-line', maxWidth: '520px' } as const

/** 按类型名索引展开后的类型定义，供 prop type tooltip 快速查找。 */
const typeDefByName = computed(() => new Map((detail.value?.typeDefs ?? []).map(t => [t.name, t] as const)))

/** 预编译当前详情的本地类型名匹配器，避免表格每个单元格重复构造 RegExp。 */
const typeDefMatchers = computed(() => (detail.value?.typeDefs ?? []).map((typeDef) => {
  const escaped = typeDef.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { name: typeDef.name, pattern: new RegExp(`\\b${escaped}\\b`) }
}))

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
  loading.value = true
  errorMsg.value = ''
  detail.value = null
  try {
    detail.value = await fetchComponentDetail(name)
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
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
  finally {
    exportingFormat.value = ''
  }
}

watch(() => props.name, load, { immediate: true })
</script>

<template>
  <div class="detail" data-testid="detail-view">
    <div class="detail-head">
      <button class="link-btn" data-testid="detail-back" @click="emit('back')">
        ← 返回总览
      </button>
      <div v-if="detail" class="detail-actions">
        <div class="export-buttons" aria-label="导出组件契约">
          <button
            v-for="format in KNOWLEDGE_EXPORT_FORMATS"
            :key="format.id"
            class="export-button"
            type="button"
            :disabled="exportingFormat === format.id"
            data-testid="detail-export-btn"
            @click="exportCurrentDetail(format.id)"
          >
            <span class="export-button-icon" aria-hidden="true">{{ format.icon }}</span>
            导出 {{ format.label }}
          </button>
        </div>
        <button
          class="link-btn ask"
          data-testid="detail-ask"
          @click="emit('ask', detail.name)"
        >
          问 AI 这个组件
        </button>
      </div>
    </div>

    <div v-if="loading" class="hint" data-testid="detail-loading">
      加载中…
    </div>
    <div v-else-if="errorMsg" class="hint error" data-testid="detail-error">
      {{ errorMsg }}
    </div>

    <template v-else-if="detail">
      <h2 class="comp-title" data-testid="detail-title">
        {{ detail.name }}
        <small>{{ detail.packageName }}</small>
      </h2>
      <p v-if="detail.description" class="desc">
        {{ detail.description }}
      </p>

      <section v-if="detail.props.length" data-testid="detail-props">
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
                <ElTooltip
                  v-if="hasTypeTooltip(p.type, p.typeRefs)"
                  :content="typeTooltipContent(typeRefsForDisplay(p.type, p.typeRefs))"
                  :popper-style="typeTooltipStyle"
                  placement="top"
                >
                  <code class="ref">{{ p.type }}</code>
                </ElTooltip>
                <code v-else>{{ p.type }}</code>
              </td>
              <td>{{ p.required ? '是' : '否' }}</td>
              <td><code v-if="p.defaultValue">{{ p.defaultValue }}</code><span v-else>—</span></td>
              <td>{{ p.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.emits.length" data-testid="detail-emits">
        <h3>Emits</h3>
        <table class="contract-table">
          <thead><tr><th>事件</th><th>载荷类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="e in detail.emits" :key="e.name">
              <td><code>{{ e.name }}</code></td>
              <td>
                <ElTooltip
                  v-if="hasTypeTooltip(e.payloadType, e.typeRefs)"
                  :content="typeTooltipContent(typeRefsForDisplay(e.payloadType, e.typeRefs))"
                  :popper-style="typeTooltipStyle"
                  placement="top"
                >
                  <code class="type-ref">{{ e.payloadType }}</code>
                </ElTooltip>
                <code v-else>{{ e.payloadType }}</code>
              </td>
              <td>{{ e.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.models.length" data-testid="detail-models">
        <h3>v-model</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>类型</th></tr></thead>
          <tbody>
            <tr v-for="m in detail.models" :key="m.name">
              <td><code>{{ m.name }}</code></td>
              <td>
                <ElTooltip
                  v-if="hasTypeTooltip(m.type)"
                  :content="typeTooltipContent(typeRefsForDisplay(m.type))"
                  :popper-style="typeTooltipStyle"
                  placement="top"
                >
                  <code class="type-ref">{{ m.type }}</code>
                </ElTooltip>
                <code v-else>{{ m.type }}</code>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.slots.length" data-testid="detail-slots">
        <h3>Slots</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>作用域类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="s in detail.slots" :key="s.name">
              <td><code>{{ s.name }}</code></td>
              <td>
                <ElTooltip
                  v-if="hasTypeTooltip(s.scopeType, s.typeRefs)"
                  :content="typeTooltipContent(typeRefsForDisplay(s.scopeType, s.typeRefs))"
                  :popper-style="typeTooltipStyle"
                  placement="top"
                >
                  <code class="type-ref">{{ s.scopeType }}</code>
                </ElTooltip>
                <code v-else>{{ s.scopeType }}</code>
              </td>
              <td>{{ s.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.attrs && detail.attrs.length" data-testid="detail-attrs">
        <h3>透传属性（$attrs）</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>类型</th><th>可选</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="a in detail.attrs" :key="a.name" data-testid="attr-row">
              <td><code>{{ a.name }}</code></td>
              <td>
                <ElTooltip
                  v-if="hasTypeTooltip(a.type)"
                  :content="typeTooltipContent(typeRefsForDisplay(a.type))"
                  :popper-style="typeTooltipStyle"
                  placement="top"
                >
                  <code class="type-ref">{{ a.type }}</code>
                </ElTooltip>
                <code v-else>{{ a.type }}</code>
              </td>
              <td>{{ a.optional ? '是' : '否' }}</td>
              <td>{{ a.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.exposed && detail.exposed.length" data-testid="detail-exposed">
        <h3>对外暴露（defineExpose）</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>类型</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="e in detail.exposed" :key="e.name" data-testid="expose-row">
              <td><code>{{ e.name }}</code></td>
              <td>
                <ElTooltip
                  v-if="hasTypeTooltip(e.type, e.typeRefs)"
                  :content="typeTooltipContent(typeRefsForDisplay(e.type, e.typeRefs))"
                  :popper-style="typeTooltipStyle"
                  placement="top"
                >
                  <code class="type-ref">{{ e.type }}</code>
                </ElTooltip>
                <code v-else>{{ e.type }}</code>
              </td>
              <td>{{ e.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.typeDefs.length" data-testid="detail-typedefs">
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
                  <ElTooltip
                    v-if="hasTypeTooltip(f.type)"
                    :content="typeTooltipContent(typeRefsForDisplay(f.type))"
                    :popper-style="typeTooltipStyle"
                    placement="top"
                  >
                    <code class="type-ref">{{ f.type }}</code>
                  </ElTooltip>
                  <code v-else>{{ f.type }}</code>
                </td>
                <td>{{ f.optional ? '是' : '否' }}</td>
                <td>{{ f.description || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.detail { padding: 20px; }
.detail-head { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.detail-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.export-buttons { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.export-button {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 6px;
  background: #f6f8fa; color: #1f2328; cursor: pointer; font-size: 12px;
}
.export-button:hover { border-color: #1f6feb; background: #ddf4ff; }
.export-button:disabled { opacity: .5; cursor: wait; }
.export-button-icon { line-height: 1; }
.link-btn {
  background: none; border: none; color: #1f6feb; cursor: pointer;
  font-size: 13px; padding: 4px 0;
}
.link-btn.ask { color: #238636; }
.hint { color: #57606a; padding: 30px 0; }
.hint.error { color: #cf222e; }
.comp-title { font-size: 22px; margin: 0 0 4px; }
.comp-title small { font-size: 13px; color: #8b949e; font-weight: 400; margin-left: 8px; }
.desc { color: #57606a; margin: 0 0 18px; }
section { margin-bottom: 24px; }
section h3 { font-size: 14px; color: #1f2328; margin: 0 0 10px; }
.contract-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
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
</style>
