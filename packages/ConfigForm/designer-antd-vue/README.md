# @moluoxixi/config-form-designer-antd-vue

ConfigForm Designer 的 Ant Design Vue 物料适配包。它提供内置字段/布局物料、运行时组件映射和属性控件，并组合成输出 Registry v3 capability 的 Designer registry。

## 安装

```bash
pnpm add @moluoxixi/config-form-designer @moluoxixi/config-form-designer-antd-vue @moluoxixi/config-form-model ant-design-vue vue
```

## 使用

```ts
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import '@moluoxixi/config-form-designer-antd-vue/styles'

export const designerRegistry = createAntdVueDesignerRegistry()
```

把 `designerRegistry` 传给 `@moluoxixi/config-form-designer` 的 `DesignSurface`、`DesignerCanvas`、`DesignerPalette` 和 `DesignerPropertyPanel`。需要把业务物料放在官方物料之前时，使用 `materials`：

```ts
const registry = createAntdVueDesignerRegistry({
  materials: [customerMaterial],
})
```

Select、AutoComplete、Radio、Checkbox 等选项物料只消费 JSON-safe 的静态 `props.options`。项目级模拟数据通过稳定的 `datasetId + projection` 合同由 Studio 组合根提供；adapter 不提供动态选项 resolver。更高级的组件、属性控件或 validator 组合使用 `layers`。

## 公开入口

- `createAntdVueDesignerRegistry`：组合业务物料与 Ant Design Vue 默认层。
- `ANTD_VUE_DESIGNER_MATERIALS`：已排序的内置物料列表。
- `ANTD_VUE_DESIGNER_COMPONENTS`：运行时组件注册表。
- `ANTD_VUE_DESIGNER_PROPERTY_CONTROLS`：属性面板控件注册表。
- `ANTD_VUE_DESIGNER_ZH_CN`：内置中文文案。

## 开发验证

```bash
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-designer-antd-vue typecheck
pnpm --filter @moluoxixi/config-form-designer-antd-vue build
```

## License

MIT
