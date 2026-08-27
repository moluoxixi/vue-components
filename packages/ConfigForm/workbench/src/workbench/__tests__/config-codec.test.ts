import type { DesignerDocument } from '@moluoxixi/config-form-designer'
import { describe, expect, it } from 'vitest'
import { DESIGNER_EXTENSION_KEY, formatDesignerConfig, parseDesignerConfig } from '../config-codec'

const document: DesignerDocument = {
  form: { columns: 24, fieldSpan: 12, gap: '16px', labelPosition: 'left' },
  nodes: [
    {
      conditions: {
        visible: { kind: 'literal', value: true },
      },
      defaultValue: 'Ada',
      extensions: { analytics: { event: 'profile-name' } },
      field: 'name',
      id: 'profile-name',
      kind: 'field',
      label: 'Name',
      material: 'element.input',
      props: { placeholder: 'Enter your name' },
      span: 12,
      validateOn: ['blur', 'submit'],
    },
    {
      id: 'profile-section',
      kind: 'container',
      material: 'element.section',
      props: { title: 'Details' },
      slots: {
        default: [
          {
            defaultValue: true,
            field: 'active',
            id: 'profile-active',
            kind: 'field',
            label: 'Active',
            material: 'element.switch',
          },
        ],
      },
    },
  ],
  version: 1,
}

describe('defineField TypeScript config codec', () => {
  it('round-trips public defineFields code and namespaced Designer metadata', () => {
    const source = formatDesignerConfig(document)

    expect(source).toContain('import { defineFields } from \'@moluoxixi/config-form-headless\'')
    expect(source).toContain('const { defineField } = defineFields<PageFormValues>()')
    expect(source).toContain('export const form =')
    expect(source).toContain('export const initialValues: PageFormValues =')
    expect(source).toContain('export const fields = [')
    expect(source).toContain('defineField({')
    expect(source).toContain(DESIGNER_EXTENSION_KEY)
    expect(parseDesignerConfig(source)).toEqual({
      document,
      initialValues: { active: true, name: 'Ada' },
      success: true,
    })
  })

  it('projects user-authored portable fields into the selected Designer adapter', () => {
    const source = `import { defineFields } from '@moluoxixi/config-form-headless'

interface Values { name: string }
const { defineField } = defineFields<Values>()
export const form = { columns: 12 }
export const initialValues = { name: 'Grace' }
export const fields = [
  defineField({ component: 'text', field: 'name', label: 'Name' }),
]
`
    expect(parseDesignerConfig(source, 'antd-vue')).toMatchObject({
      document: {
        form: { columns: 12 },
        nodes: [{ defaultValue: 'Grace', field: 'name', material: 'antd.input' }],
      },
      initialValues: { name: 'Grace' },
      success: true,
    })
  })

  it('keeps dynamic or incomplete TypeScript drafts out of the document projection', () => {
    const valid = formatDesignerConfig(document)
    expect(parseDesignerConfig('export const fields = createFields()')).toMatchObject({ success: false })
    expect(parseDesignerConfig(valid.replace('export const form =', 'export const form = getForm() &&'))).toMatchObject({ success: false })
    expect(parseDesignerConfig(valid.replace('defineField({', 'defineField({ ...shared,'))).toMatchObject({ success: false })
    expect(parseDesignerConfig(`const broken = {\n${valid}`)).toMatchObject({ success: false })
  })
})
