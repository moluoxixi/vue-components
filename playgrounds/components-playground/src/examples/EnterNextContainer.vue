<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'EnterNextContainer',
  title: 'EnterNextContainer',
  category: '表单输入',
  description: '表单控件之间的 Enter 顺序聚焦和末尾事件场景。',
  order: 20,
}
</script>

<script setup lang="ts">
import { EnterNextContainer } from '@moluoxixi/components'
import { reactive, shallowRef } from 'vue'

const formModel = reactive({
  customerName: '上海一号门店',
  contact: '',
  level: '',
  remark: '',
})

const lastEvent = shallowRef('等待输入')

function handleNoNextInput(element: HTMLElement): void {
  lastEvent.value = `已到最后一个控件：${element.tagName.toLowerCase()}`
}

function handleNoSelectValue(element: HTMLElement): void {
  lastEvent.value = `下拉控件未确认选项：${element.tagName.toLowerCase()}`
}
</script>

<template>
  <EnterNextContainer
    :focus-num="1"
    @no-next-input="handleNoNextInput"
    @no-select-value="handleNoSelectValue"
  >
    <ElForm class="enter-next-example" :model="formModel" label-width="96px" data-testid="enter-next-example">
      <ElFormItem label="客户名称">
        <ElInput v-model="formModel.customerName" data-testid="enter-next-name" />
      </ElFormItem>

      <ElFormItem label="联系人">
        <ElInput v-model="formModel.contact" data-testid="enter-next-contact" />
      </ElFormItem>

      <ElFormItem label="客户等级">
        <ElSelect v-model="formModel.level" clearable data-testid="enter-next-level">
          <ElOption label="核心客户" value="core" />
          <ElOption label="普通客户" value="standard" />
          <ElOption label="观察客户" value="watch" />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="备注">
        <ElInput v-model="formModel.remark" data-testid="enter-next-remark" type="textarea" :rows="3" />
      </ElFormItem>

      <ElFormItem label="事件">
        <ElTag type="info" data-testid="enter-next-event">
          {{ lastEvent }}
        </ElTag>
      </ElFormItem>
    </ElForm>
  </EnterNextContainer>
</template>

<style scoped lang="scss">
.enter-next-example {
  max-width: 680px;
}
</style>
