import type { DesignerSourceMaterialBinding } from '@moluoxixi/config-form-designer'

interface AntdSourceOptions {
  native?: boolean
  options?: DesignerSourceMaterialBinding['options']
  render?: DesignerSourceMaterialBinding['render']
  staticProps?: DesignerSourceMaterialBinding['staticProps']
}

export function antdSource(
  configComponent: string,
  tag: string,
  options: AntdSourceOptions = {},
): DesignerSourceMaterialBinding {
  return {
    configComponent,
    tag,
    render: options.render ?? 'component',
    ...(options.native
      ? {}
      : {
          library: {
            packageName: 'ant-design-vue',
            plugin: 'Antd',
            stylesheet: 'ant-design-vue/dist/reset.css',
          },
        }),
    ...(options.options ? { options: options.options } : {}),
    ...(options.staticProps ? { staticProps: options.staticProps } : {}),
  }
}
