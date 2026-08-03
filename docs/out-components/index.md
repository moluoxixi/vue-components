# 组件库对外文档索引

## 来源快照

| 字段 | 值 |
|---|---|
| sourceCommit | `f9497c29cc1e` |
| sourceState | dirty；本轮新增 CopyText、HeadlessCopyText、RichTextEditor、测试、示例与对外契约文档。 |
| generatedBy | 手工契约修复；`components-docs` skill 不可用，开发者已于 2026-07-17 确认替代流程。 |
| sourceRoots | `packages/components`、`packages/ConfigForm/shadcn`、`packages/ConfigForm/runtime` |
| sourceFiles | `packages/components/src/index.ts`、`packages/components/src/CopyText`、`packages/components/src/HeadlessCopyText`、`packages/components/src/RichTextEditor`、`packages/components/src/ElementConfigForm`、`packages/components/src/AntdConfigForm`、`packages/components/src/ConfigTable`、`packages/components/src/DateRangePicker`、`packages/components/src/EnterNextContainer`、`packages/components/src/PopoverTableSelect`、`packages/components/src/RequestSelectV2`、`packages/components/src/RequestCascader`、`packages/components/src/RequestTreeSelect`、`packages/components/src/request`、`packages/ConfigForm/shadcn/src`、`packages/ConfigForm/runtime/src`、`playgrounds/components-playground/src/examples` |

## 组件清单

| 组件 | 文档 | 来源 |
|---|---|---|
| CopyText / HeadlessCopyText | [CopyText](CopyText.md) | `packages/components/src/CopyText`、`packages/components/src/HeadlessCopyText` |
| DateRangePicker | [DateRangePicker](DateRangePicker.md) | `packages/components/src/DateRangePicker` |
| EnterNextContainer | [EnterNextContainer](EnterNextContainer.md) | `packages/components/src/EnterNextContainer` |
| ConfigTable | [ConfigTable](ConfigTable.md) | `packages/components/src/ConfigTable` |
| PopoverTableSelect | [PopoverTableSelect](PopoverTableSelect.md) | `packages/components/src/PopoverTableSelect` |
| RequestSelectV2 | [RequestSelectV2](RequestSelectV2.md) | `packages/components/src/RequestSelectV2` |
| RequestCascader | [RequestCascader](RequestCascader.md) | `packages/components/src/RequestCascader` |
| RequestTreeSelect | [RequestTreeSelect](RequestTreeSelect.md) | `packages/components/src/RequestTreeSelect` |
| RichTextEditor | [RichTextEditor](RichTextEditor.md) | `packages/components/src/RichTextEditor` |
| ElementConfigForm | [ElementConfigForm](ElementConfigForm.md) | `packages/components/src/ElementConfigForm` |
| AntdConfigForm | [AntdConfigForm](AntdConfigForm.md) | `packages/components/src/AntdConfigForm` |
| ShadcnConfigForm | [ShadcnConfigForm](ShadcnConfigForm.md) | `packages/ConfigForm/shadcn` |
| RuntimeConfigForm | [RuntimeConfigForm](RuntimeConfigForm.md) | `packages/ConfigForm/runtime` |
| ConfigFormInternalComponents | [ConfigFormInternalComponents](ConfigFormInternalComponents.md) | `packages/components/src/*ConfigForm/src/components`、`packages/ConfigForm/*/src/components` |

## 发现说明

`discover-components.mjs` 的候选清单包含 `src`、`types`、`utils` 等目录噪声；最终组件清单以 package 入口导出、组件源码、示例和测试证据为准。
