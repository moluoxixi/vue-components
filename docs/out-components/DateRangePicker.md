# DateRangePicker组件文档

## 用途

`DateRangePicker` 是基于 Element Plus `ElDatePicker` 的日期选择封装，用于统一日期、日期范围、日期时间范围的默认值、禁用边界、快捷项和输出格式。组件来源为 `packages/components/src/DateRangePicker`。

## 引入

```ts
import type { DateRangePickerProps } from '@moluoxixi/components'
import { DateRangePicker } from '@moluoxixi/components'
```

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| type | `DatePickerProps['type']` | `date` | 否 | Element Plus DatePicker 的选择类型。 |
| format | `string` | 按类型推导 | 否 | 输入框展示格式。 |
| valueFormat | `string` | `YYYY-MM-DD HH:mm:ss` | 否 | 内部绑定格式，也是字符串入参解析格式。 |
| placeholder | `string` | `请选择日期` | 否 | 非范围选择占位内容。 |
| startPlaceholder | `string` | `开始日期` | 否 | 范围开始占位内容。 |
| endPlaceholder | `string` | `结束日期` | 否 | 范围结束占位内容。 |
| rangeSeparator | `string` | `至` | 否 | 范围分隔符。 |
| modelValue | `string \| number \| Date \| string[] \| number[] \| Date[]` | `[]` | 否 | 外部绑定值，单日期使用单值，范围使用数组。 |
| outputFormat | `string \| string[]` | 按类型推导 | 否 | 输出格式；数组可分别配置开始值和结束值。 |
| defaultToday | `boolean` | `true` | 否 | 首次无值时是否自动使用今天作为默认值。 |
| dateRange | `number \| number[]` | `undefined` | 否 | 首次无值时生成默认值的日期偏移配置；不参与禁用日期判断。 |
| dateRangeType | `ManipulateType` | `day` | 否 | `dateRange` 生成默认值时使用的偏移单位。 |
| dateRangeBaseDate | `ConfigType` | 当前日期 | 否 | `dateRange` 生成默认值时使用的基准日期。 |
| minDate | `ConfigType` | `0001-01-01 00:00:00` | 否 | 最小可选日期。 |
| maxDate | `ConfigType` | `9999-12-31 23:59:59` | 否 | 最大可选日期。 |
| disabledDateRange | `[ConfigType, ConfigType]` | `undefined` | 否 | 可选日期边界，范围外日期会被禁用，优先级高于 `minDate/maxDate`。 |
| datetimeDisableTypes | `('hours' \| 'minutes' \| 'seconds')[]` | 全部单位 | 否 | `datetime/datetimerange` 下按边界禁用的单位。 |
| shortcuts | `boolean \| DateRangePickerShortcut[]` | `false` | 否 | `true` 使用默认快捷项，数组使用自定义快捷项。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| update:modelValue | 绑定值更新时触发，单日期返回字符串，范围返回字符串数组。 |
| change | 用户确认选择时触发，返回值形态与 `v-model` 一致。 |

## 插槽或 Children

当前没有自定义插槽；Element Plus DatePicker 的透传能力通过 `$attrs` 保留。

## 状态

- 空值首次挂载时可按 `defaultToday` 或 `dateRange` 生成默认值并同步给调用方；`dateRange` 不控制禁用日期。
- `disabledDateRange`、`minDate`、`maxDate` 控制日期可选边界，边界外日期禁用；当前组件不支持只禁用某个内部日期区间。
- `datetimeDisableTypes` 控制时、分、秒禁用规则。
- `shortcuts=true` 使用今天、三天、一周、一个月四个默认快捷项。

## 可访问性

组件复用 Element Plus DatePicker 的输入、弹层和键盘交互能力；调用方应提供清晰的占位内容，外层表单负责 label 与错误提示关联。

## 示例

```vue
<DateRangePicker
  v-model="dateValues.dayRange"
  type="daterange"
  :default-today="false"
  :shortcuts="true"
  start-placeholder="开始日期"
  end-placeholder="结束日期"
  @change="handleChange"
/>
```

## 测试建议

覆盖默认日期同步、Element Plus 配置透传、用户选择后的格式化输出、默认快捷项实例隔离和禁用边界。

## 变更记录

- 2026-06-07：根据源码、类型和测试生成组件契约文档。
