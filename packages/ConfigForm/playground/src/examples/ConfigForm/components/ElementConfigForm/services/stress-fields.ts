import type { ConfigFormNode } from '@moluoxixi/config-form-headless'
import type { ElementStressValues } from '../types'
import { defineFields } from '@moluoxixi/config-form-headless'
import { ElInput } from 'element-plus'

export const ELEMENT_STRESS_FIELD_COUNT = 200

const { defineField } = defineFields<ElementStressValues>()

export function createElementStressValues(): ElementStressValues {
  return Object.fromEntries(
    Array.from({ length: ELEMENT_STRESS_FIELD_COUNT }, (_, index) => {
      const number = index + 1
      return [`stressField${number}`, `布局压测 ${number}`]
    }),
  )
}

export const elementStressFields: ConfigFormNode<ElementStressValues>[] = Array.from(
  { length: ELEMENT_STRESS_FIELD_COUNT },
  (_, index) => {
    const number = index + 1
    const field = `stressField${number}`
    return defineField({
      component: ElInput,
      field,
      id: `element-stress-${field}`,
      label: `压测 ${number}`,
      props: { 'placeholder': `布局压测字段 ${number}`, 'data-testid': `element-layout-stress-input-${number}` },
      span: 6,
    })
  },
)
