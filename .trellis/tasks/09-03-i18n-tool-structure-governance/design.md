# I18n Tool 结构治理技术设计

## 1. 稳定边界

```text
CLI -> config -> ServerContext -> scan / translate / preview / apply
UI -> /__i18n-tool/api -> router -> ServerContext
root/core/config/protocol/server -> 既有 dist entries
```

保持五个 exports、bin、UI base、HTTP prefix/header、wire schema、错误码、文件格式和构建产物名不变。

## 2. UI Ownership

```text
src/ui/
  main.ts
  styles.css
  App/
    index.ts
    index.vue
    components/
      WorkspaceTabs/{index.ts,index.vue}
      WorkspaceTopbar/{index.ts,index.vue}
      ChangesView/{index.ts,index.vue}
      ResourcesView/{index.ts,index.vue}
      TranslateView/{index.ts,index.vue}
      index.ts
    services/{api.ts,index.ts}
    state/{workbench.ts,index.ts}
```

App 的请求 epoch、AbortController 与 reducer owner 不变，只迁移文件；五个 child 继续只由 App 消费。

## 3. Config 与 Core

```text
src/config/
  index.ts
  schemas/{config.ts,index.ts}
  services/{loader.ts,index.ts}
  types/{config.ts,index.ts}

src/core/
  index.ts
  adapters/{index.ts,json-adapter.ts,generic-json.ts,i18next-json.ts,vue-i18n-json.ts}
  constants/{diagnostics.ts,index.ts}
  services/{analysis.ts,operations.ts,registry.ts,translation.ts,index.ts}
  utils/{identity.ts,json.ts,tokens.ts,index.ts}
  types/index.ts
```

Core index 显式维持原符号集合。Protocol 通过 Core constants/types 公共边界读取诊断集合；Core 不依赖 config/server/UI。

## 4. Server Domain

```text
src/server/
  index.ts
  errors/{i18n-tool-error.ts,index.ts}
  runtime/{index.ts,services/{context.ts,index.ts}}
  resources/{index.ts,services/{resource-pattern.ts,scanner.ts,index.ts}}
  filesystem/{index.ts,services/{atomic-write.ts,path-guard.ts,index.ts}}
  http/{index.ts,adapters/{plugin.ts,router.ts,index.ts}}
```

依赖方向为 http -> runtime -> resources/filesystem/errors -> config/core/shared。resources 可依赖 filesystem path guard；任何 domain 不反向依赖 http/runtime。

## 5. CLI 与动态边界

- CLI 通过 config/server public barrels 装配，不改变 options 与 output。
- `loadI18nToolConfig` 继续使用 `createJiti(import.meta.url)` 和 absolute configPath 动态加载用户配置。
- Vite 仍仅在 CLI server 中使用，UI 仍构建到 `dist/ui`；`./protocol` 是唯一 browser-safe public package entry。

## 6. Characterization 与验证

- CLI 测试 mock Vite/config/server boundary，锁定 help、success、invalid option/port/config error、stdout/stderr/exit。
- UI owner move 运行 UI app/api/state unit 与五条 E2E。
- config/core/server move 运行 package 全量 unit/coverage/typecheck/build。
- packed browser 扫描继续拒绝 `absolutePath`、`apiKeyEnv`、`node:fs`、`writeTextAtomically`。

## 7. 回滚

characterization、UI、config/core、server、收口分批提交。任一安全协议、CLI output、公开 symbol、E2E 或 browser leak 回归时只回滚对应批次，不恢复旧私有路径 shim。
