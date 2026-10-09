<script setup lang="ts">
import type { StudioDiagnostic } from '../types/editor-session'
import { AlertCircle, CheckCircle2, ChevronUp, Info, TriangleAlert, X } from '@lucide/vue'
import { computed, ref, useId } from 'vue'

const props = defineProps<{ diagnostics: readonly StudioDiagnostic[], open: boolean, locale: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean], 'locate': [diagnostic: StudioDiagnostic] }>()
const filter = ref<'all' | StudioDiagnostic['severity']>('all')
const listId = `${useId()}-studio-issues`
const chinese = computed(() => props.locale === 'zh-CN')
const severityOrder = { error: 0, warning: 1, info: 2 }
const visible = computed(() =>
  props.diagnostics.filter(item => filter.value === 'all' || item.severity === filter.value)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]),
)
const errors = computed(() => props.diagnostics.filter(item => item.severity === 'error').length)
const warnings = computed(() => props.diagnostics.filter(item => item.severity === 'warning').length)
const infos = computed(() => props.diagnostics.filter(item => item.severity === 'info').length)
const status = computed(() => errors.value ? 'error' : warnings.value ? 'warning' : infos.value ? 'info' : 'success')
const summary = computed(() => {
  if (!props.diagnostics.length)
    return chinese.value ? '当前设计通过检查' : 'Design checks passed'
  return [
    errors.value ? chinese.value ? `${errors.value} 个错误` : `${errors.value} ${errors.value === 1 ? 'error' : 'errors'}` : '',
    warnings.value ? chinese.value ? `${warnings.value} 个警告` : `${warnings.value} ${warnings.value === 1 ? 'warning' : 'warnings'}` : '',
    infos.value ? chinese.value ? `${infos.value} 条提示` : `${infos.value} ${infos.value === 1 ? 'note' : 'notes'}` : '',
  ].filter(Boolean).join(' · ')
})
const filters = computed(() => [
  { id: 'all' as const, label: chinese.value ? '全部' : 'All', count: props.diagnostics.length },
  { id: 'error' as const, label: chinese.value ? '错误' : 'Errors', count: errors.value },
  { id: 'warning' as const, label: chinese.value ? '警告' : 'Warnings', count: warnings.value },
  ...(infos.value || filter.value === 'info' ? [{ id: 'info' as const, label: chinese.value ? '提示' : 'Notes', count: infos.value }] : []),
])

function canLocate(item: StudioDiagnostic): boolean {
  return Boolean(item.nodeId || item.datasetId || item.resourceId || item.surfaceId)
}

function originLabel(item: StudioDiagnostic): string {
  return chinese.value
    ? { model: '配置检查', compiler: '设计检查', preview: '体验检查', export: '交付检查' }[item.origin]
    : { model: 'Configuration check', compiler: 'Design check', preview: 'Experience check', export: 'Handoff check' }[item.origin]
}

function severityLabel(item: StudioDiagnostic): string {
  return chinese.value
    ? { error: '错误', warning: '警告', info: '提示' }[item.severity]
    : { error: 'Error', warning: 'Warning', info: 'Note' }[item.severity]
}
</script>

<template>
  <section class="studio-issues-dock" :data-open="open" :data-status="status">
    <header>
      <button
        type="button"
        :aria-expanded="open"
        :aria-controls="listId"
        @click="emit('update:open', !open)"
      >
        <AlertCircle v-if="status === 'error'" :size="16" aria-hidden="true" />
        <TriangleAlert v-else-if="status === 'warning'" :size="16" aria-hidden="true" />
        <Info v-else-if="status === 'info'" :size="16" aria-hidden="true" />
        <CheckCircle2 v-else :size="16" aria-hidden="true" />
        <strong>{{ chinese ? '问题' : 'Issues' }}</strong><span>{{ diagnostics.length }}</span>
        <small>{{ summary }}</small>
        <ChevronUp :size="14" :style="{ transform: open ? 'rotate(180deg)' : undefined }" />
      </button>
      <span class="studio-issues-hint">{{ chinese ? '命令中心' : 'Command center' }} <kbd>Ctrl K</kbd></span>
    </header>
    <div v-if="open" :id="listId" class="studio-issues-body">
      <div class="studio-issues-filters">
        <div role="group" :aria-label="chinese ? '问题筛选' : 'Filter issues'">
          <button v-for="option in filters" :key="option.id" type="button" :aria-pressed="filter === option.id" @click="filter = option.id">
            {{ option.label }} <span>{{ option.count }}</span>
          </button>
        </div>
        <button
          type="button"
          :aria-label="chinese ? '关闭问题面板' : 'Close issues'"
          @click="emit('update:open', false)"
        >
          <X :size="14" />
        </button>
      </div>
      <article
        v-for="(item, index) in visible"
        :key="`${item.origin}:${item.code}:${index}`"
        class="studio-issue"
        :data-severity="item.severity"
      >
        <component :is="canLocate(item) ? 'button' : 'div'" :type="canLocate(item) ? 'button' : undefined" class="studio-issue-main" @click="canLocate(item) && emit('locate', item)">
          <TriangleAlert v-if="item.severity === 'warning'" :size="17" aria-hidden="true" />
          <Info v-else-if="item.severity === 'info'" :size="17" aria-hidden="true" />
          <AlertCircle v-else :size="17" aria-hidden="true" />
          <span><strong>{{ item.message }}</strong><small>{{ severityLabel(item) }} · {{ originLabel(item) }}</small></span>
          <span v-if="canLocate(item)" class="studio-issue-locate">{{ chinese ? '定位 →' : 'Locate →' }}</span>
        </component>
        <details class="studio-issue-details">
          <summary>{{ chinese ? '查看详情' : 'Details' }}</summary>
          <code>{{ item.code }}<template v-if="item.path?.length"> · {{ item.path.join('.') }}</template></code>
        </details>
      </article>
      <div v-if="!visible.length" class="studio-issues-empty" role="status">
        <template v-if="diagnostics.length">
          <p>{{ chinese ? '当前分类下没有问题，其他分类仍有待处理项。' : 'No issues in this category. Other categories still have items to review.' }}</p>
          <button type="button" @click="filter = 'all'">
            {{ chinese ? '查看全部问题' : 'Show all issues' }}
          </button>
        </template>
        <p v-else>
          {{ chinese ? '检查通过，可以继续设计或体验表单。' : 'Checks passed. Continue designing or try the form.' }}
        </p>
      </div>
    </div>
  </section>
</template>
