import type { ImportsMap } from 'unplugin-auto-import/types'
import type { ComponentResolverFunction } from 'unplugin-vue-components/types'

const packageName = '@moluoxixi/components'
const packageStyles = '@moluoxixi/components/styles'

const automaticExports = {
  components: [
    'AntdConfigForm',
    'ConfigTable',
    'CopyText',
    'DateRangePicker',
    'ElementConfigForm',
    'EnterNextContainer',
    'HeadlessCopyText',
    'HeadlessTable',
    'PopoverTableSelect',
    'RequestCascader',
    'RequestSelectV2',
    'RequestTreeSelect',
    'RichTextEditor',
  ],
  imports: [
    'antdConfigForm',
    'ClipboardCopyError',
    'collectAllConfigFormFields',
    'collectConfigFormFields',
    'copyText',
    'createConfigFormController',
    'createHeadlessTableRenderer',
    'defineConfigFormField',
    'defineConfigFormFields',
    'defineField',
    'defineFields',
    'defineHeadlessTableRenderer',
    'formatConfigFormReadonlyValue',
    'formatConfigFormZodIssues',
    'getHeadlessTableColumnId',
    'getHeadlessTableColumnLabel',
    'getHeadlessTableRawValue',
    'headlessTableRenderer',
    'headlessTableRendererKey',
    'isConfigFormField',
    'isConfigFormFieldReadonly',
    'isConfigFormNodeVisible',
    'isEmptyConfigFormRequiredValue',
    'normalizeConfigFormValidateOn',
    'provideHeadlessTableRenderer',
    'resolveConfigFormCondition',
    'resolveConfigFormFieldStates',
    'resolveConfigFormReadonlyRender',
    'shouldValidateConfigFormOn',
    'useHeadlessTable',
    'validateConfigFormFieldRules',
    'withInstall',
  ],
} as const

const componentNames = new Set<string>(automaticExports.components)

/** Resolve public components and their shared stylesheet for unplugin-vue-components. */
export const autoComponent: ComponentResolverFunction = (name) => {
  if (!componentNames.has(name))
    return undefined

  return {
    from: packageName,
    name,
    sideEffects: packageStyles,
  }
}

/** Runtime helper preset for unplugin-auto-import. Types remain explicit imports. */
export const autoImport = {
  [packageName]: [...automaticExports.imports],
} satisfies ImportsMap
