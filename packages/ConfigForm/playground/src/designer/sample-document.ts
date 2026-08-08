import type { DesignerDocument } from '@moluoxixi/config-form-designer'

export function createDesignerSampleDocument(): DesignerDocument {
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
        material: 'element.section',
        span: 12,
        props: {
          title: 'Account details',
          description: 'Edit the structure and preview the real Element Plus form.',
        },
        slots: {
          default: [
            {
              id: 'designer-name',
              kind: 'field',
              material: 'element.input',
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
        material: 'element.card',
        span: 12,
        props: { header: 'Preferences', shadow: 'never' },
        slots: {
          default: [
            {
              id: 'designer-choice',
              kind: 'field',
              material: 'element.select',
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
        material: 'element.switch',
        field: 'enabled',
        label: 'Enabled',
        defaultValue: true,
      },
    ],
  }
}
