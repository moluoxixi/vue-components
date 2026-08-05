import type { ImportsMap } from 'unplugin-auto-import/types'
import type { ComponentResolverFunction } from 'unplugin-vue-components/types'

const packageName = '@moluoxixi/components'
const packageStyles = '@moluoxixi/components/styles'

export const componentNames = [
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
] as const

const componentNameSet = new Set<string>(componentNames)

/** Resolve public components from their smallest package subpath. */
export const autoComponent: ComponentResolverFunction = (name) => {
  if (!componentNameSet.has(name))
    return undefined

  return {
    from: `${packageName}/${name}`,
    name,
    sideEffects: packageStyles,
  }
}

/** Runtime helper preset grouped by public subpath. Types remain explicit imports. */
export const autoImport = {
  [`${packageName}/AntdConfigForm`]: ['antdConfigForm'],
  [`${packageName}/CopyText`]: ['ClipboardCopyError', 'copyText'],
  [`${packageName}/HeadlessTable`]: [
    'createHeadlessTableRenderer',
    'defineHeadlessTableRenderer',
    'getHeadlessTableColumnId',
    'getHeadlessTableColumnLabel',
    'getHeadlessTableRawValue',
    'headlessTableRenderer',
    'headlessTableRendererKey',
    'provideHeadlessTableRenderer',
    'useHeadlessTable',
  ],
  [`${packageName}/configForm`]: [
    'collectAllConfigFormFields',
    'collectConfigFormFields',
    'createConfigFormController',
    'defineConfigFormField',
    'defineConfigFormFields',
    'defineField',
    'defineFields',
    'formatConfigFormReadonlyValue',
    'formatConfigFormZodIssues',
    'isConfigFormField',
    'isConfigFormFieldReadonly',
    'isConfigFormNodeVisible',
    'isEmptyConfigFormRequiredValue',
    'normalizeConfigFormValidateOn',
    'resolveConfigFormCondition',
    'resolveConfigFormFieldStates',
    'resolveConfigFormReadonlyRender',
    'shouldValidateConfigFormOn',
    'validateConfigFormFieldRules',
    'withInstall',
  ],
} satisfies ImportsMap
