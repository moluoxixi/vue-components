<script setup lang="ts">
import { CopyText } from '@moluoxixi/components'
import { shallowRef } from 'vue'

const lastCopied = shallowRef('等待复制')
</script>

<template>
  <div class="copy-text-example" data-testid="copy-text-example">
    <div class="copy-text-example__row">
      <span class="copy-text-example__label">订单号</span>
      <CopyText text="PO-2026-0803" @copy="lastCopied = $event" />
    </div>

    <div class="copy-text-example__row">
      <span class="copy-text-example__label">访问令牌</span>
      <CopyText text="mx_live_d3m0_t0ken" @copy="lastCopied = $event">
        <template #default="{ text }">
          <code>{{ text }}</code>
        </template>
      </CopyText>
    </div>

    <div class="copy-text-example__row">
      <span class="copy-text-example__label">Headless</span>
      <HeadlessCopyText text="HEADLESS-COPY-001" @copy="lastCopied = $event">
        <template #default="{ copy, copied, copying }">
          <ElButton
            type="primary"
            plain
            :loading="copying"
            @click="copy().catch(() => undefined)"
          >
            {{ copied ? '已复制 Headless 值' : '复制 Headless 值' }}
          </ElButton>
        </template>
      </HeadlessCopyText>
    </div>

    <ElDivider />
    <ElDescriptions :column="1" border>
      <ElDescriptionsItem label="最近复制">
        <span data-testid="copy-text-last">{{ lastCopied }}</span>
      </ElDescriptionsItem>
    </ElDescriptions>
  </div>
</template>

<style scoped>
.copy-text-example {
  max-width: 720px;
}

.copy-text-example__row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  min-height: 46px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.copy-text-example__label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.copy-text-example code {
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-color-danger-dark-2);
}

@media (max-width: 560px) {
  .copy-text-example__row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px 0;
  }
}
</style>
