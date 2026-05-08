<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { reactive, ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createAntdVuePlugin } from '@moluoxixi/config-form-plugin-antd-vue'
import Card from 'ant-design-vue/es/card'
import Checkbox, { CheckboxGroup } from 'ant-design-vue/es/checkbox'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const runtimeOptions = {
  plugins: [createAntdVuePlugin()],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    component: Card,
    props: {
      class: 'nested-card nested-card--outer',
      size: 'small',
      title: '外层 Card 容器',
    },
    slots: {
      default: [
        defineField({
          component: Card,
          props: {
            class: 'nested-card nested-card--inner',
            size: 'small',
            title: '内层 Card 容器',
          },
          slots: {
            default: [
              defineField({
                field: 'permissionScopes',
                label: '权限范围',
                schema: z.array(z.string()).min(1, '请至少选择一个权限范围'),
                span: 24,
                component: CheckboxGroup,
                defaultValue: [],
                slots: {
                  default: [
                    defineField({
                      component: Checkbox,
                      props: { value: 'read' },
                      slots: { default: defineField({ component: 'span', props: { textContent: '读取数据' } }) },
                    }),
                    defineField({
                      component: Checkbox,
                      props: { value: 'write' },
                      slots: { default: defineField({ component: 'span', props: { textContent: '编辑数据' } }) },
                    }),
                    defineField({
                      component: Checkbox,
                      props: { value: 'publish' },
                      slots: { default: defineField({ component: 'span', props: { textContent: '发布配置' } }) },
                    }),
                  ],
                },
              }),
            ],
          },
        }),
      ],
    },
  }),
]

/**
 * 展示嵌套容器表单的提交结果。
 *
 * 示例只验证容器节点不会绑定值，提交内容只包含真实字段。
 */
function onSubmit(values: Record<string, unknown>) {
  Object.assign(formValues, values)
  alert(JSON.stringify(values, null, 2))
}
</script>

<template>
  <div>
    <ConfigForm
      ref="formRef"
      :default-values="formValues"
      namespace="nested-card"
      :fields="fields"
      :runtime="runtimeOptions"
      label-width="96px"
      @submit="onSubmit"
    />

    <div class="demo-actions">
      <a-button type="primary" @click="formRef?.submit()">
        提交
      </a-button>
      <a-button @click="formRef?.validate()">
        校验
      </a-button>
      <a-button @click="formRef?.reset()">
        重置
      </a-button>
    </div>

    <a-divider>提交值快照</a-divider>
    <pre class="value-preview">{{ JSON.stringify(formValues, null, 2) }}</pre>
  </div>
</template>

<style lang="scss">
.nested-card {
  grid-column: 1 / -1;
}

.nested-card--outer {
  border-color: #91caff;
}

.nested-card--inner {
  border-color: #d9d9d9;
}

.nested-card + .nested-card {
  margin-top: 12px;
}

.demo-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.value-preview {
  background: #fafafa;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
}
</style>
