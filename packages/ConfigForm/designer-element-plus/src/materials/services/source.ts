import type { DesignerSourceMaterialBinding } from '@moluoxixi/config-form-designer'

interface ElementSourceOptions {
  native?: boolean
  options?: DesignerSourceMaterialBinding['options']
  render?: DesignerSourceMaterialBinding['render']
  staticProps?: DesignerSourceMaterialBinding['staticProps']
}

export function elementSource(
  configComponent: string,
  tag: string,
  options: ElementSourceOptions = {},
): DesignerSourceMaterialBinding {
  return {
    configComponent,
    tag,
    render: options.render ?? 'component',
    ...(options.native
      ? {}
      : {
          library: {
            packageName: 'element-plus',
            plugin: 'ElementPlus',
            stylesheet: 'element-plus/dist/index.css',
          },
        }),
    ...(options.options ? { options: options.options } : {}),
    ...(options.staticProps ? { staticProps: options.staticProps } : {}),
  }
}
