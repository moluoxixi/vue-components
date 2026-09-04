# @moluoxixi/config-form-designer-element-plus

ConfigForm Designer 的 Element Plus 物料适配包。它提供内置字段/布局物料、运行时组件映射、Element Plus 属性控件和选项来源诊断，并组合成可直接使用的 Designer registry。

## 安装

```bash
pnpm add @moluoxixi/config-form-designer @moluoxixi/config-form-designer-element-plus @moluoxixi/config-form-model element-plus vue
```

## 使用

```ts
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import '@moluoxixi/config-form-designer-element-plus/styles'

export const designerRegistry = createElementPlusDesignerRegistry()
```

把 `designerRegistry` 传给 `@moluoxixi/config-form-designer` 的 `DesignSurface`、`DesignerCanvas`、`DesignerPalette` 和 `DesignerPropertyPanel`。需要让业务物料优先于默认物料时，使用 `materials`：

```ts
const registry = createElementPlusDesignerRegistry({
  materials: [customerMaterial],
})
```

Select、Radio、Checkbox 等动态选项物料可以通过 `optionResolver` 接入业务数据源；更高级的组件、属性控件或 validator 组合使用 `layers`。

## 公开入口

- `createElementPlusDesignerRegistry`：组合业务物料与 Element Plus 默认层。
- `ELEMENT_PLUS_DESIGNER_MATERIALS`：已排序的内置物料列表。
- `ELEMENT_PLUS_DESIGNER_COMPONENTS`：运行时组件注册表。
- `ELEMENT_PLUS_DESIGNER_PROPERTY_CONTROLS`：属性面板控件注册表。
- `ELEMENT_PLUS_DESIGNER_ZH_CN`：内置中文文案。
- `styles` 与各组件 `style` 子路径：整包或按需 Sass 入口。

## 开发验证

```bash
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck
pnpm --filter @moluoxixi/config-form-designer-element-plus build
```

## License

MIT
