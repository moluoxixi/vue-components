# 组件库对外文档索引

## 来源快照

| 字段 | 值 |
|---|---|
| sourceCommit | `ae3470ea53e606fa9a5117f8f2c7879233712024` |
| sourceState | dirty；当前未提交内容包含 request/cache hooks、request 组件、ConfigTable/PopoverTableSelect request/pagination 扩展、测试与文档。 |
| generatedBy | `components-docs` provider mode |
| sourceRoots | `packages/components`、`packages/ConfigForm/antd`、`packages/ConfigForm/element`、`packages/ConfigForm/shadcn`、`packages/ConfigForm/runtime` |
| sourceFiles | `packages/components/src/index.ts`、`packages/components/src/ConfigTable`、`packages/components/src/DateRangePicker`、`packages/components/src/EnterNextContainer`、`packages/components/src/PopoverTableSelect`、`packages/components/src/RequestSelectV2`、`packages/components/src/RequestCascader`、`packages/components/src/RequestTreeSelect`、`packages/components/src/request`、`packages/ConfigForm/*/src`、`playgrounds/components-playground/src/examples/*ConfigForm.vue` |

## 组件清单

| 组件 | 文档 | 来源 |
|---|---|---|
| DateRangePicker | [DateRangePicker](DateRangePicker.md) | `packages/components/src/DateRangePicker` |
| EnterNextContainer | [EnterNextContainer](EnterNextContainer.md) | `packages/components/src/EnterNextContainer` |
| ConfigTable | [ConfigTable](ConfigTable.md) | `packages/components/src/ConfigTable` |
| PopoverTableSelect | [PopoverTableSelect](PopoverTableSelect.md) | `packages/components/src/PopoverTableSelect` |
| RequestSelectV2 | [RequestSelectV2](RequestSelectV2.md) | `packages/components/src/RequestSelectV2` |
| RequestCascader | [RequestCascader](RequestCascader.md) | `packages/components/src/RequestCascader` |
| RequestTreeSelect | [RequestTreeSelect](RequestTreeSelect.md) | `packages/components/src/RequestTreeSelect` |
| ElementConfigForm | [ElementConfigForm](ElementConfigForm.md) | `packages/ConfigForm/element` |
| AntdConfigForm | [AntdConfigForm](AntdConfigForm.md) | `packages/ConfigForm/antd` |
| ShadcnConfigForm | [ShadcnConfigForm](ShadcnConfigForm.md) | `packages/ConfigForm/shadcn` |
| RuntimeConfigForm | [RuntimeConfigForm](RuntimeConfigForm.md) | `packages/ConfigForm/runtime` |
| ConfigFormInternalComponents | [ConfigFormInternalComponents](ConfigFormInternalComponents.md) | `packages/ConfigForm/*/src/components` |

## 发现说明

`discover-components.mjs` 的候选清单包含 `src`、`types`、`utils` 等目录噪声；最终组件清单以 package 入口导出、组件源码、示例和测试证据为准。
