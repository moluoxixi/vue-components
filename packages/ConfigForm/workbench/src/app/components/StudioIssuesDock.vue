<script setup lang="ts">
import type { StudioDiagnostic } from '../types/editor-session'
import { AlertCircle, CheckCircle2, ChevronUp, X } from '@lucide/vue'
import { computed, ref } from 'vue'

const props = defineProps<{ diagnostics: readonly StudioDiagnostic[], open: boolean, locale: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean], 'locate': [diagnostic: StudioDiagnostic] }>()
const filter = ref('all')
const chinese = computed(() => props.locale === 'zh-CN')
const visible = computed(() =>
  props.diagnostics.filter(item => filter.value === 'all' || item.severity === filter.value),
)
const errors = computed(() => props.diagnostics.filter(item => item.severity === 'error').length)
</script>

<template>
  <section class="studio-issues-dock" :data-open="open">
    <header>
      <button
        type="button"
        :aria-expanded="open"
        aria-controls="studio-issues-list"
        @click="emit('update:open', !open)"
      >
        <AlertCircle v-if="diagnostics.length" :size="14" /><CheckCircle2 v-else :size="14" />
        <strong>{{ chinese ? '问题' : 'Issues' }}</strong><span>{{ diagnostics.length }}</span>
        <small>{{
          diagnostics.length
            ? `${errors} ${chinese ? '错误' : 'errors'}`
            : chinese
              ? '当前设计通过检查'
              : 'Design checks passed'
        }}</small>
        <ChevronUp :size="14" :style="{ transform: open ? 'rotate(180deg)' : undefined }" />
      </button>
      <span class="studio-issues-hint">{{ chinese ? '命令中心' : 'Command center' }} <kbd>Ctrl K</kbd></span>
    </header>
    <div v-if="open" id="studio-issues-list" class="studio-issues-body">
      <div class="studio-issues-filters">
        <ElSelect
          v-model="filter"
          size="small"
          :aria-label="chinese ? '问题筛选' : 'Filter issues'"
          append-to="#workbench-overlays"
        >
          <ElOption value="all" :label="chinese ? '全部' : 'All'" /><ElOption
            value="error"
            :label="chinese ? '错误' : 'Errors'"
          /><ElOption value="warning" :label="chinese ? '警告' : 'Warnings'" />
        </ElSelect><button
          type="button"
          :aria-label="chinese ? '关闭问题面板' : 'Close issues'"
          @click="emit('update:open', false)"
        >
          <X :size="14" />
        </button>
      </div>
      <button
        v-for="(item, index) in visible"
        :key="`${item.origin}:${item.code}:${index}`"
        type="button"
        class="studio-issue"
        :data-severity="item.severity"
        @click="emit('locate', item)"
      >
        <AlertCircle :size="15" /><span><strong>{{ item.message }}</strong><small>{{ item.origin }} · {{ item.code
        }}<template v-if="item.path?.length"> · {{ item.path.join('.') }}</template></small></span><span v-if="item.nodeId || item.datasetId || item.resourceId" class="studio-issue-locate">{{
          chinese ? '定位 →' : 'Locate →'
        }}</span>
      </button>
      <p v-if="!visible.length" class="studio-issues-empty">
        {{ chinese ? '没有需要处理的问题。' : 'No issues to resolve.' }}
      </p>
    </div>
  </section>
</template>
