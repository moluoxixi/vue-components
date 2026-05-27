<script setup lang="ts">
import type { ConfigFormExpose, FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineFields } from '@moluoxixi/config-form'
import { computed, reactive, shallowRef } from 'vue'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { createShadcnVuePlugin } from '@/shadcn-form'

interface AccountFormValues extends Record<string, unknown> {
  accountName: string
  plan: 'starter' | 'pro' | 'enterprise'
  owner: string
  notes?: string
}

const submittedValues = reactive<Partial<AccountFormValues>>({})
const formRef = shallowRef<ConfigFormExpose<AccountFormValues>>()
const { defineField } = defineFields<AccountFormValues>()

const planOptions = [
  { label: 'Starter / 单人项目', value: 'starter' },
  { label: 'Pro / 团队协作', value: 'pro' },
  { label: 'Enterprise / 企业治理', value: 'enterprise' },
] as const

const runtimeOptions = {
  plugins: [createShadcnVuePlugin()],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'accountName',
    label: '账户名称',
    component: 'Input',
    span: 12,
    required: true,
    requiredMessage: '请输入账户名称',
    schema: z.string().min(2, '账户名称至少 2 个字符'),
    props: {
      placeholder: '例如 Moluoxixi Cloud',
    },
  }),
  defineField({
    field: 'owner',
    label: '负责人',
    component: 'Input',
    span: 12,
    required: true,
    requiredMessage: '请输入负责人',
    schema: z.string().min(2, '负责人至少 2 个字符'),
    props: {
      placeholder: '例如 Ada',
    },
  }),
  defineField({
    field: 'plan',
    label: '套餐',
    component: 'NativeSelect',
    defaultValue: 'pro',
    span: 12,
    required: true,
    requiredMessage: '请选择套餐',
    schema: z.enum(['starter', 'pro', 'enterprise']),
    props: {
      options: planOptions,
    },
    slots: {
      default: planOptions.map(option =>
        defineField({
          component: NativeSelectOption,
          props: { value: option.value },
          slots: {
            default: defineField({
              component: 'span',
              props: { textContent: option.label },
            }),
          },
        }),
      ),
    },
  }),
  defineField({
    field: 'notes',
    label: '备注',
    component: 'Textarea',
    span: 24,
    schema: z.string().max(160, '备注最多 160 个字符').optional(),
    props: {
      placeholder: '记录接入范围、审批人或迁移说明',
    },
  }),
]

const valuePreview = computed(() => JSON.stringify(submittedValues, null, 2))

/**
 * playground 只展示 ConfigForm 和 shadcn-vue 的接入结果。
 *
 * 提交值写入本地快照，避免示例引入远端 API 依赖。
 */
function onSubmit(values: AccountFormValues): void {
  Object.assign(submittedValues, values)
}
</script>

<template>
  <Card class="shadcn-demo">
    <CardHeader>
      <CardTitle>编辑态表单</CardTitle>
      <CardDescription>
        使用 shadcn-vue 本地组件作为 ConfigForm 字段组件。
      </CardDescription>
    </CardHeader>

    <CardContent>
      <ConfigForm
        ref="formRef"
        :fields="fields"
        :runtime="runtimeOptions"
        namespace="shadcn-cf"
        label-width="88px"
        gap="14px 16px"
        @submit="onSubmit"
      />
    </CardContent>

    <CardFooter class="shadcn-demo__footer">
      <div class="shadcn-demo__actions">
        <Button type="button" @click="formRef?.submit()">
          提交
        </Button>
        <Button type="button" variant="outline" @click="formRef?.validate()">
          校验
        </Button>
        <Button type="button" variant="ghost" @click="formRef?.reset()">
          重置
        </Button>
      </div>

      <Separator />

      <pre class="shadcn-demo__preview">{{ valuePreview }}</pre>
    </CardFooter>
  </Card>
</template>
