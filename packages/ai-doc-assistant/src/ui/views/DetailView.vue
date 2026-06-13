<script setup lang="ts">
/**
 * 详情视图：单组件完整契约。
 * 挂载 / name 变化时拉取 GET /components/:name，分区渲染 props / emits / slots /
 * v-model 表格与展开的关联自定义类型（typeDefs）。props 的 typeRefs 高亮，
 * 指引用户到下方类型定义区查字段结构（方案 A 成果的可视化呈现）。
 */
import { ref, watch } from 'vue'
import type { ComponentDetailResponse } from '../../shared/protocol'
import { fetchComponentDetail } from '../api'

const props = defineProps<{ name: string }>()
const emit = defineEmits<{ (e: 'back'): void, (e: 'ask', name: string): void }>()

/** 当前组件详情；null 表示加载中或失败。 */
const detail = ref<ComponentDetailResponse | null>(null)
/** 错误信息。 */
const errorMsg = ref('')
/** 加载中标志。 */
const loading = ref(false)

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

watch(() => props.name, load, { immediate: true })
</script>

<template>
  <div class="detail" data-testid="detail-view">
    <div class="detail-head">
      <button class="link-btn" data-testid="detail-back" @click="emit('back')">
        ← 返回总览
      </button>
      <button
        v-if="detail"
        class="link-btn ask"
        data-testid="detail-ask"
        @click="emit('ask', detail.name)"
      >
        问 AI 这个组件
      </button>
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
              <td><code>{{ p.name }}</code></td>
              <td>
                <code :class="{ ref: p.typeRefs.length }">{{ p.type }}</code>
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
              <td><code>{{ e.payloadType }}</code></td>
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
              <td><code>{{ m.type }}</code></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="detail.slots.length" data-testid="detail-slots">
        <h3>Slots</h3>
        <table class="contract-table">
          <thead><tr><th>名称</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="s in detail.slots" :key="s.name">
              <td><code>{{ s.name }}</code></td>
              <td>{{ s.description || '—' }}</td>
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
                <td><code>{{ f.type }}</code></td>
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
.detail-head { display: flex; justify-content: space-between; margin-bottom: 16px; }
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
code.ref { background: #ddf4ff; color: #0969da; }
.typedef { margin-bottom: 16px; }
.typedef-name { margin-bottom: 6px; }
.typedef-name small { color: #8b949e; margin-left: 8px; font-size: 11px; }
</style>
