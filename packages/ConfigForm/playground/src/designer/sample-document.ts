import type { DesignerDocument } from '@moluoxixi/config-form-designer'

export type DesignerAdapter = 'element-plus' | 'antd-vue'

export function createDesignerSampleDocument(adapter: DesignerAdapter = 'element-plus'): DesignerDocument {
  const prefix = adapter === 'element-plus' ? 'element' : 'antd'
  return {
    version: 1,
    form: {
      columns: 24,
      gap: '16px',
      fieldSpan: 24,
      labelPosition: 'left',
      responsive: {
        tablet: { columns: 12, fieldSpan: 12 },
        mobile: { columns: 1, fieldSpan: 1 },
      },
    },
    nodes: [
      {
        id: 'designer-section',
        kind: 'container',
        material: `${prefix}.section`,
        span: 12,
        props: {
          title: 'Account details',
          description: `Edit the structure and preview the real ${adapter === 'element-plus' ? 'Element Plus' : 'Ant Design Vue'} form.`,
        },
        slots: {
          default: [
            {
              id: 'designer-name',
              kind: 'field',
              material: `${prefix}.input`,
              field: 'name',
              label: 'Name',
              props: { placeholder: 'Your name' },
              validation: {
                version: 1,
                base: { type: 'string' },
                rules: [
                  { kind: 'required', message: 'Please enter your name' },
                  { kind: 'minLength', value: 2, message: 'Use at least two characters' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'designer-card',
        kind: 'container',
        material: `${prefix}.card`,
        span: 12,
        props: adapter === 'element-plus'
          ? { header: 'Preferences', shadow: 'never' }
          : { title: 'Preferences', bordered: true },
        slots: {
          default: [
            {
              id: 'designer-choice',
              kind: 'field',
              material: `${prefix}.select`,
              field: 'environment',
              label: 'Environment',
              defaultValue: 'playground',
              conditions: {
                disabled: {
                  kind: 'compare',
                  operator: 'eq',
                  left: { kind: 'field', field: 'enabled' },
                  right: { kind: 'literal', value: false },
                },
              },
              props: {
                optionSource: { kind: 'dictionary', key: 'environments' },
                options: [
                  { label: 'Playground', value: 'playground' },
                  { label: 'Production', value: 'production' },
                ],
                placeholder: 'Choose environment',
              },
            },
          ],
        },
      },
      {
        id: 'designer-enabled',
        kind: 'field',
        material: `${prefix}.switch`,
        field: 'enabled',
        label: 'Enabled',
        defaultValue: true,
      },
    ],
  }
}
