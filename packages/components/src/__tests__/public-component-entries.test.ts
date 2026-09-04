import * as ComponentsRoot from '@moluoxixi/components'
import ConfigTableDefault, { ConfigTable } from '@moluoxixi/components/ConfigTable'
import CopyTextDefault, { CopyText } from '@moluoxixi/components/CopyText'
import DateRangePickerDefault, { DateRangePicker } from '@moluoxixi/components/DateRangePicker'
import EnterNextContainerDefault, { EnterNextContainer } from '@moluoxixi/components/EnterNextContainer'
import HeadlessCopyTextDefault, { HeadlessCopyText } from '@moluoxixi/components/HeadlessCopyText'
import HeadlessTableDefault, { HeadlessTable } from '@moluoxixi/components/HeadlessTable'
import PopoverTableSelectDefault, { PopoverTableSelect } from '@moluoxixi/components/PopoverTableSelect'
import RequestCascaderDefault, { RequestCascader } from '@moluoxixi/components/RequestCascader'
import RequestSelectV2Default, { RequestSelectV2 } from '@moluoxixi/components/RequestSelectV2'
import RequestTreeSelectDefault, { RequestTreeSelect } from '@moluoxixi/components/RequestTreeSelect'
import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'

const componentEntries = [
  ['ConfigTable', ConfigTable, ConfigTableDefault],
  ['CopyText', CopyText, CopyTextDefault],
  ['DateRangePicker', DateRangePicker, DateRangePickerDefault],
  ['EnterNextContainer', EnterNextContainer, EnterNextContainerDefault],
  ['HeadlessCopyText', HeadlessCopyText, HeadlessCopyTextDefault],
  ['HeadlessTable', HeadlessTable, HeadlessTableDefault],
  ['PopoverTableSelect', PopoverTableSelect, PopoverTableSelectDefault],
  ['RequestCascader', RequestCascader, RequestCascaderDefault],
  ['RequestSelectV2', RequestSelectV2, RequestSelectV2Default],
  ['RequestTreeSelect', RequestTreeSelect, RequestTreeSelectDefault],
] as const

describe('public component entries', () => {
  it.each(componentEntries)('keeps %s root, leaf, default and install identity stable', (name, component, defaultExport) => {
    const app = createApp({ render: () => null })

    expect(defaultExport).toBe(component)
    expect(ComponentsRoot[name]).toBe(component)
    expect(component.name).toBe(name)
    app.use(component)
    expect(app.component(name)).toBe(component)
  })
})
