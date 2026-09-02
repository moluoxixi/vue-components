import type { FieldConfig } from '@moluoxixi/config-form/plugins'

/** Ant Design Vue field two-way binding contract. */
export type AntdVueFieldBinding
  = Required<Pick<FieldConfig, 'valueProp' | 'trigger'>>
    & Pick<FieldConfig, 'props'>
