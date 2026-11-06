<script setup lang="ts">
import { ElConfigProvider } from 'element-plus'
import { inject, ref } from 'vue'
import { docsConsumerNamespaceKey } from './consumer-namespace'

const namespace = inject(docsConsumerNamespaceKey, ref('el'))
</script>

<template>
  <ElConfigProvider :namespace="namespace">
    <slot />
  </ElConfigProvider>
</template>
