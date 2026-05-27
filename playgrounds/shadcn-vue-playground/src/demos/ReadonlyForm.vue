<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineFields } from '@moluoxixi/config-form'
import { z } from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createShadcnVuePlugin } from '@/shadcn-form'

interface ReadonlyFormValues extends Record<string, unknown> {
  accountName: string
  plan: 'starter' | 'pro' | 'enterprise'
  owner: string
  notes: string
}

const { defineField } = defineFields<ReadonlyFormValues>()

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
    defaultValue: 'Moluoxixi Cloud',
    readonly: true,
    span: 12,
    schema: z.string().optional(),
  }),
  defineField({
    field: 'owner',
    label: '负责人',
    component: 'Input',
    defaultValue: 'Ada',
    readonly: true,
    span: 12,
    schema: z.string().optional(),
  }),
  defineField({
    field: 'plan',
    label: '套餐',
    component: 'NativeSelect',
    defaultValue: 'enterprise',
    readonly: true,
    span: 12,
    schema: z.enum(['starter', 'pro', 'enterprise']).optional(),
    props: {
      options: planOptions,
    },
  }),
  defineField({
    field: 'notes',
    label: '备注',
    component: 'Textarea',
    defaultValue: '只读态由 runtime readonlyAdapters 映射展示，不回落到原组件禁用态。',
    readonly: true,
    span: 24,
    schema: z.string().optional(),
  }),
]
</script>

<template>
  <Card class="shadcn-demo">
    <CardHeader>
      <CardTitle>只读态表单</CardTitle>
      <CardDescription>
        选择字段通过 shadcn-vue 适配器显示 label，文本字段保留原始值展示。
      </CardDescription>
    </CardHeader>

    <CardContent>
      <ConfigForm
        :fields="fields"
        :runtime="runtimeOptions"
        namespace="shadcn-cf"
        label-width="88px"
        gap="14px 16px"
      />
    </CardContent>
  </Card>
</template>
