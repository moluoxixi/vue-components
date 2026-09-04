# Vite Config 结构治理技术设计

## 1. 稳定公开边界

```text
@moluoxixi/vite-config
@moluoxixi/vite-config/addons
@moluoxixi/vite-config/addons/<name>
```

根入口继续显式组合 addons、app、base、lib 和 public types。tsup 从新 service 目录生成与当前完全相同的 `dist/addons/index` 和 15 个 addon subpath 产物；不新增 package export，也不把内部 config 路径公开。

## 2. 目标目录

```text
src/
  addons/
    index.ts
    services/
      index.ts
      <addon>.ts
  config/
    app/{index.ts,services/{index.ts,config.ts}}
    lib/{index.ts,services/{index.ts,config.ts}}
    services/{index.ts,merge.ts}
    base/
      index.ts
      services/{index.ts,config.ts}
      addons/
        index.ts
        types/{index.ts,domain.ts}
        adapters/{index.ts,context.ts}
        defaults/{index.ts,patterns.ts}
        utils/{index.ts,options.ts,plugins.ts}
        services/{index.ts,config.ts,registry.ts,runtime.ts,<feature>.ts}
  types/index.ts
```

所有 `index.ts` 只导出。公开 addon helper 是普通配置 identity service；base addon 的 Node `createRequire`/dependency detection/dynamic import 只属于 adapter，不能进入 browser surface。

## 3. 运行时合同

- Registry 顺序固定为 Vue、React、UnoCSS、Tailwind、Router、Layouts、Auto Import、Components、Pages、I18n、Devtools、PWA、Markdown、Vitest、Vite SSG。
- 启用优先级保持 `false > explicit true/payload > detected trigger > disabled`。
- `resolveFeatureOrder` 保持依赖先行和独立 feature 声明顺序；duplicate/cycle/unknown dependency 错误文本不变。
- `createAddonContext` 继续从 `viteConfig.root` 创建 `require`，使用 `node/import` conditions 解析目标项目模块，失败清除缓存并保留现有错误上下文。
- `mergeAddonOptions` 保持用户数组在前、去重、默认值回填；`mergeConfigWithUserPlugins` 保持用户同名插件替换自动插件。

## 4. Characterization

- 从根、聚合 subpath 和每个 addon subpath 导入，断言 exact named export 与 helper 引用一致。
- 对 concrete registry 断言 feature 顺序、triggers、requires 和 dependsOn。
- 复用现有 runtime/feature matrix/real project/browser tests覆盖动态加载、错误、merge、插件输出和真实 CSS。

## 5. 分批实施

1. 先补公开 surface 与 registry characterization。
2. 迁移公开 addon helper、public types、app/lib/base config factories 和 merge service，更新 tsup/测试 alias。
3. 拆 base addon runtime/shared/registry 与 15 个 feature service，删除 35 条 debt，更新文档和 spec。

## 6. 回滚

三批独立提交。任一 public export、dist path、fixture output、错误文本或动态加载回归时只回滚对应批次，不恢复旧私有路径 shim。
