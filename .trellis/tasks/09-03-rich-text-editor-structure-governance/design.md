# 富文本编辑器结构治理技术设计

## 1. 结构边界

```text
packages/rich-text-editor/
  index.ts
  README.md
  src/
    components/
      index.ts
      RichTextEditor/
        index.ts
        index.vue
    composables/
    types/
    utils/
```

`src/components/index.ts` 与 `RichTextEditor/index.ts` 只导出；根 `index.ts` 从组件责任 barrel 获取实现，继续组合 Vue plugin，并从 `src/types` 显式公开类型。

## 2. 兼容边界

- `RichTextEditor` 命名导出、默认导出和组件 `name` 保持不变。
- `app.use(RichTextEditor)` 继续注册名为 `RichTextEditor` 的同一组件对象。
- `modelValue`、事件、slots、expose、TipTap extensions、HTML 输出、样式选择器与 CSS 产物名不变。
- 不保留 `src/index.vue` 转发文件；仓库内没有该 deep path consumer，公开消费者只走包根。

## 3. 发布合同

`package.json.files` 包含 `dist`、`index.ts`、`src`，使 `exports["."].source` 在 tarball 中真实存在。README 采用中文作为默认说明，记录组件、插件和样式入口；现有中英文 docs 不因目录移动改写。

## 4. 验证

- 单测从包根断言命名/默认导出一致、组件名与 plugin install。
- 现有编辑器测试继续覆盖 HTML 同步、格式命令、disabled/readonly 和 toolbar slot。
- build/typecheck 证明新相对 import 与声明生成成立。
- architecture 删除精确 debt 并拒绝 unknown/stale 诊断。
- packed Node/type/browser smoke 证明发布 source、runtime、types 与 CSS 入口可消费。

## 5. 回滚

本批只包含路径移动、barrel、package files、README、入口测试和 manifest debt 删除。任一行为或发布门禁失败时整体回滚，不增加旧路径 shim。
