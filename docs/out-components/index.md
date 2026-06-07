# 组件库对外文档索引

## 来源快照

| 字段 | 值 |
|---|---|
| sourceCommit | `a58da6d91a06aa122c0b70b7499306877f73fbc7` |
| sourceState | dirty；当前未提交内容为初始化规则、docs 骨架和文档输出，`git status --porcelain` 未显示组件源码文件修改。 |
| generatedBy | `components-docs` provider mode |
| sourceRoots | `packages/components`、`packages/ConfigForm/antd`、`packages/ConfigForm/element`、`packages/ConfigForm/shadcn`、`packages/ConfigForm/runtime` |
| sourceFiles | `packages/components/src/index.ts`、`packages/components/src/DateRangePicker`、`packages/components/src/EnterNextContainer`、`packages/components/src/PopoverTableSelect`、`packages/ConfigForm/*/src`、`playgrounds/components-playground/src/examples/*ConfigForm.vue` |

## 组件清单

| 组件 | 文档 | 来源 |
|---|---|---|
| DateRangePicker | [DateRangePicker](DateRangePicker.md) | `packages/components/src/DateRangePicker` |
| EnterNextContainer | [EnterNextContainer](EnterNextContainer.md) | `packages/components/src/EnterNextContainer` |
| PopoverTableSelect | [PopoverTableSelect](PopoverTableSelect.md) | `packages/components/src/PopoverTableSelect` |
| ElementConfigForm | [ElementConfigForm](ElementConfigForm.md) | `packages/ConfigForm/element` |
| AntdConfigForm | [AntdConfigForm](AntdConfigForm.md) | `packages/ConfigForm/antd` |
| ShadcnConfigForm | [ShadcnConfigForm](ShadcnConfigForm.md) | `packages/ConfigForm/shadcn` |
| RuntimeConfigForm | [RuntimeConfigForm](RuntimeConfigForm.md) | `packages/ConfigForm/runtime` |
| ConfigFormInternalComponents | [ConfigFormInternalComponents](ConfigFormInternalComponents.md) | `packages/ConfigForm/*/src/components` |

## 发现说明

`discover-components.mjs` 的候选清单包含 `src`、`types`、`utils` 等目录噪声；最终组件清单以 package 入口导出、组件源码、示例和测试证据为准。
