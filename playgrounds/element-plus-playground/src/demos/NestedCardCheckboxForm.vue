<script setup lang="ts">
import { reactive, ref } from 'vue'
import { z } from 'zod'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { ElCard, ElCheckbox, ElCheckboxGroup } from 'element-plus'

const formRef = ref()
const formValues = reactive<Record<string, unknown>>({})

const fields = [
  defineField({
    component: ElCard,
    props: {
      class: 'nested-card nested-card--outer',
      header: '外层 Card 容器',
      shadow: 'never',
    },
    slots: {
      default: [
        defineField({
          component: ElCard,
          props: {
            class: 'nested-card nested-card--inner',
            header: '内层 Card 容器',
            shadow: 'never',
          },
          slots: {
            default: [
              defineField({
                field: 'permissionScopes',
                label: '权限范围',
                schema: z.array(z.string()).min(1, '请至少选择一个权限范围'),
                span: 24,
                component: ElCheckboxGroup,
                defaultValue: [],
                slots: {
                  default: [
                    defineField({
                      component: ElCheckbox,
                      props: { label: '读取数据', value: 'read' },
                    }),
                    defineField({
                      component: ElCheckbox,
                      props: { label: '编辑数据', value: 'write' },
                    }),
                    defineField({
                      component: ElCheckbox,
                      props: { label: '发布配置', value: 'publish' },
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
      label-width="96px"
      @submit="onSubmit"
    />

    <div class="demo-actions">
      <el-button type="primary" @click="formRef?.submit()">
        提交
      </el-button>
      <el-button @click="formRef?.validate()">
        校验
      </el-button>
      <el-button @click="formRef?.reset()">
        重置
      </el-button>
    </div>

    <el-divider>提交值快照</el-divider>
    <pre class="value-preview">{{ JSON.stringify(formValues, null, 2) }}</pre>
  </div>
</template>

<style lang="scss">
.nested-card {
  grid-column: 1 / -1;
}

.nested-card--outer {
  border-color: #a0cfff;
}

.nested-card--inner {
  border-color: #dcdfe6;
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
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 300px;
  overflow: auto;
}
</style>
