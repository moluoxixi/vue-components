import type { DesignerDocument } from '@moluoxixi/config-form-designer'

export function createDesignerSampleDocument(): DesignerDocument {
  return {
    version: 1,
    form: {
      columns: 2,
      gap: '16px',
      fieldSpan: 1,
      labelPosition: 'left',
    },
    nodes: [
      {
        id: 'designer-section',
        kind: 'container',
        material: 'element.section',
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
              props: {
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
