<script setup lang="ts">
// default import 的第三方/别名组件 + v-bind="$attrs"：specifier 被捕获但非相对 .vue，
// 应命中正则否定分支跳过合并而非抛错（区别于 ThirdPartyForward 的具名 import !specifier 分支）。
import SomeWidget from 'some-widget-lib'

interface Props {
  /** 标题 */
  title?: string
}
defineProps<Props>()
</script>

<template>
  <SomeWidget v-bind="$attrs" />
</template>
