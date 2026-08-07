<script setup lang="ts">
import { useToc } from '../../composables/use-toc'

const headers = useToc()
const removeTag = (str: string) => str.replace(/<span.*<\/span>/g, '')
</script>

<template>
  <aside ref="container" class="toc-wrapper">
    <nav class="toc-content">
      <h3 class="toc-content__heading">Contents</h3>
      <el-anchor :offset="70" :bound="120">
        <el-anchor-link
          v-for="{ link, text, children } in headers"
          :key="link"
          :href="link"
          :title="text"
        >
          <div :title="removeTag(text)" v-html="text" />
          <template v-if="children" #sub-link>
            <el-anchor-link
              v-for="{ link: childLink, text: childText } in children"
              :key="childLink"
              :href="childLink"
              :title="text"
            >
              <div :title="removeTag(childText)" v-html="childText" />
            </el-anchor-link>
          </template>
        </el-anchor-link>
      </el-anchor>
    </nav>
    <div class="toc-content-mask" />
  </aside>
</template>

<style scoped lang="scss">
.el-anchor__item {
  .el-anchor__link > div {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
