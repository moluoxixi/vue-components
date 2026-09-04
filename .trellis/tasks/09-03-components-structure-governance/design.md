# 通用组件包结构治理技术设计

## 1. 稳定公开边界

保持以下入口不变：

```text
@moluoxixi/components
@moluoxixi/components/<10 public components>
@moluoxixi/components/auto-loaders
@moluoxixi/components/playground-manifest
@moluoxixi/components/styles
```

根入口继续显式导出公开组件与共享 composables；每个 component subpath 的 source/build/types 路径仍以 `<Feature>/index.ts` 为边界。

## 2. Feature 目录

```text
src/<Feature>/
  index.ts
  components/
    index.ts
    <Feature>/
      index.ts
      index.vue
      components/       # 仅该公开组件使用的子组件
  composables/          # 需要时
  services/
    index.ts
    component.ts        # withInstall 组合
  types/
  utils/                # 需要时
  __tests__/
  docs/
```

Feature 与责任 `index.ts` 都只导出。`component.ts` 从 component barrel 获取 SFC，并用包级 `withInstall` 生成唯一安装对象；named export、default export 与 Vue plugin 注册目标必须保持同一引用。

## 3. 组件依赖链

```text
PopoverTableSelect -> ConfigTable -> HeadlessTable
CopyText -> HeadlessCopyText
Request* -> request shared feature
```

跨 feature 只导入 feature barrel，不进入另一个 feature 的 `components` 或 `types` 私有路径。ConfigTable/Popover 的私有子组件进入其公开组件 owner 的 `components/`。

## 4. HeadlessTable Renderer

`renderer.ts` 是可变 registry、Vue injection 和 plugin service，不是纯 utils 或 Vue SFC。整体移动到 `HeadlessTable/services/renderer.ts`，与安装 component service 一同由 `services/index.ts` 导出；不拆散 resolver/registry 语义。

## 5. Characterization

- 从根与 10 个 leaf 静态导入，断言 default/named/root identity、组件 `name`、`.install` 注册名和对象。
- 保留 auto-loader 双向集合、styles sideEffect 与 playground manifest 测试。
- 现有单测继续覆盖每个组件行为；HeadlessTable/ConfigTable 锁定 renderer precedence、reactivity、injection 与插件。

## 6. 分批

1. 公开 entry 与 install characterization。
2. CopyText/HeadlessCopyText、DateRangePicker、EnterNextContainer、Request 三组件归位。
3. HeadlessTable、ConfigTable、PopoverTableSelect 与 renderer service 归位，删除全部 debt，更新文档/spec。

## 7. 回滚

每批独立提交。任一 public entry、组件行为、样式、auto-loader、playground 或 renderer 回归时回滚对应批次，不恢复旧私有路径 shim。
