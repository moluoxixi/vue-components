# shadcn-vue playground

这个 playground 用于验证 `@moluoxixi/config-form` 通过 runtime plugin 接入 shadcn-vue 本地组件。

## 边界

- 只覆盖 shadcn-vue 接入示例，不承载 `@moluoxixi/components` 包的组件演示。
- shadcn-vue 组件代码由 `shadcn-vue` registry 生成到 `src/components/ui`，作为当前 playground 的本地 UI 源码。
- ConfigForm 适配代码位于 `src/shadcn-form`，示例页面位于 `src/demos`。

## 开发

```bash
pnpm dev:shadcn
```

```bash
pnpm -C playgrounds/shadcn-vue-playground typecheck
```
