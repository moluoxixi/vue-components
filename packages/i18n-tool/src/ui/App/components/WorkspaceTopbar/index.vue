<script setup lang="ts">
import type { SanitizedConfigResponse } from '../../../../shared/protocol'
import type { RequestStatus } from '../../state'
import { Languages, RefreshCw, Wifi, WifiOff } from '@lucide/vue'

const props = defineProps<{
  config?: SanitizedConfigResponse
  refreshStatus: RequestStatus
}>()

defineEmits<{
  refresh: []
}>()
</script>

<template>
  <header class="topbar">
    <div class="brand" aria-label="I18n Tool">
      <span class="brand-mark" aria-hidden="true"><Languages :size="20" /></span>
      <span class="brand-copy">
        <strong>I18n Tool</strong>
        <small>{{ props.config?.projectName ?? 'Local workspace' }}</small>
      </span>
    </div>

    <div class="topbar-meta">
      <span v-if="props.config" class="adapter-label">{{ props.config.resources.adapter }}</span>
      <span
        v-if="props.config"
        class="provider-state"
        :class="`is-${props.config.ai.status}`"
        role="status"
      >
        <Wifi v-if="props.config.ai.status === 'configured'" :size="15" aria-hidden="true" />
        <WifiOff v-else :size="15" aria-hidden="true" />
        AI {{ props.config.ai.status === 'configured' ? 'ready' : 'missing' }}
      </span>
      <el-tooltip content="Rescan locale resources" placement="bottom">
        <el-button
          class="icon-button"
          circle
          :loading="props.refreshStatus === 'loading'"
          aria-label="Rescan locale resources"
          @click="$emit('refresh')"
        >
          <RefreshCw v-if="props.refreshStatus !== 'loading'" :size="17" aria-hidden="true" />
        </el-button>
      </el-tooltip>
    </div>
  </header>
</template>
