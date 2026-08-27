# 国际化工具与共享 AI 配置设计

## 架构目标

建立两个职责明确的可发布包，并迁移一个现有消费者：

```text
@moluoxixi/ai-provider
  shared DTO + server-only config/transport
          ↑
          ├── @moluoxixi/ai-doc-assistant
          └── @moluoxixi/i18n-tool
                 config -> adapters -> translation
                    -> local BFF -> Vue workbench
```

- `@moluoxixi/ai-provider` 只拥有供应商配置、OpenAI-compatible transport、取消与错误脱敏。
- `@moluoxixi/i18n-tool` 拥有用户配置、国际化资源语义、翻译编排、安全文件服务和 UI。
- `@moluoxixi/ai-doc-assistant` 保留文档检索、prompt、来源协议和聊天 UI，通过兼容层迁移到共享包。

## 包边界

### `@moluoxixi/ai-provider`

- `.` / `./shared`：无密钥 DTO、`ChatMessage`、脱敏状态、稳定错误码；不得依赖 Node。
- `./server`：secret config、显式 env key/default mapping、chat/embedding transport、redactor。
- 共享 loader 接受消费者提供的环境变量映射和默认值；`AI_DOC_*` 留在 AI 文档助手兼容 adapter，不成为共享默认。

### `@moluoxixi/i18n-tool`

```text
src/
  config/        config type, discovery, loader, resolver
  core/          resource model, diagnostics, operations
  adapters/      vue-i18n-json, i18next-json, generic-json
  translation/   batching, prompt, runtime schema, token validation
  shared/        browser-safe protocol and limits
  server/        workspace, router, path guard, preview/apply
  ui/            Vue application and API client
  cli.ts         local server entry
```

- `defineConfig()` 只提供类型推断；`resolveConfig()` 负责默认值、路径、互斥项和 schema 校验。
- Vite 只承载包内 UI，使用 `configFile: false`，不加载用户项目的 Vite 配置。
- domain core 不依赖 HTTP、Vue 或真实 fs；server 通过 adapter registry 和 filesystem 接口消费 core。

## 配置契约

配置文件默认发现 `i18n-tool.config.ts/.mts/.js/.mjs`，显式 `--config` 优先。最小形状：

```ts
export default defineConfig({
  root: '.',
  resources: {
    adapter: 'vue-i18n-json',
    include: ['locales/**/*.json'],
    exclude: [],
    layout: 'locale-per-file',
    sourceLocale: 'zh-CN',
    targetLocales: ['en-US'],
    localePattern: 'locales/{locale}.json',
  },
  ai: {
    baseUrl: 'https://coderelay.cn/v1',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'I18N_TOOL_AI_API_KEY',
  },
  server: { host: '127.0.0.1', port: 5174, open: true },
})
```

- `resources` 在 MVP 是单一资源 profile，避免多个适配器同时写同一目录；后续可升级为 profiles 数组。
- locale/namespace/输出路径必须由显式 pattern 决定，不通过不可靠文件名猜测。
- UI 只获得 resolved/sanitized config，不获得 `apiKeyEnv` 对应值或绝对路径。

## 资源模型与适配器

- `TranslationUnit` 使用结构化 identity：adapter、resource ID、locale、namespace、真实 path、source key。
- 真实 path 与 literal dotted key 分开存储，避免 `{a:{b}}` 和 `{"a.b": ...}` 冲突。
- 文档保留格式元数据；MVP 承诺语义 round-trip，并尽量保持缩进、EOL、末尾换行和 key 顺序。
- i18next 后缀不被重命名；plural/context family 共同翻译和校验。
- 模型只接收 opaque unit ID、源文本和 protected-token manifest，不接触文件路径、key 生成或 output pattern。

## 数据流

```text
CLI load/resolve config
  -> canonical project/resource roots
  -> scan JSON and issue scanId/resourceId/baseline hash
  -> compute missing units
  -> batch AI translation with AbortSignal
  -> runtime schema + placeholder/family validation
  -> user edits/accepts candidates
  -> preview rebuilds normalized operations and text diff
  -> apply re-reads baseline and revalidates
  -> same-directory temp write + rename
  -> rescan verifies persisted result
```

`preview` 与 `apply` 是两次独立服务端验证。apply 只接受服务端签发的 token，不接受浏览器提交绝对路径或任意 operation。

## 状态与错误

- config：`validating -> ready | invalid`。
- scan：`idle -> scanning -> scanned | failed | cancelled`。
- translation：`queued -> translating -> translated | partially_failed | failed | cancelled`。
- review：`reviewing -> preview_ready | preview_invalid | stale`。
- apply：`applying -> applied | conflict | failed`。

稳定错误至少区分 invalid config、unsupported adapter、payload/limit、path/symlink、scan、AI missing/upstream/model output、placeholder/schema、preview required/stale、write conflict/failure 和 cancelled。服务端日志可保留内部 cause，但公开 DTO 只含脱敏摘要。

## 安全边界

- 默认只监听 loopback；副作用 API 要求 POST、私有 header 和 Origin/Referer 同源。
- 所有资源用服务端签发的相对 ID 表示；每次 scan/preview/apply 都重新执行 lexical + canonical containment。
- 不存在目标通过最近存在祖先做 realpath 校验；拒绝 symlink/junction 逃逸。
- 请求和任务有集中限额；apply 串行化或按资源加锁。
- secret 只在 server memory，禁止进入响应、日志、配置文件和浏览器 bundle。

## UI 设计

- 第一屏是安静、紧凑的操作工作台，不做 landing page。
- 顶栏显示项目、adapter、AI 状态和必要命令；主体按资源扫描、翻译审阅、变更预览组织。
- 审阅使用高密度表格，diff 自身滚动；移动端改为可扫描的单列或分段详情，不制造页面级横向溢出。
- 状态、错误、tab/step、dialog 和图标按钮遵循现有 AI 文档助手可访问契约。

## 兼容与发布

- AI 文档助手根入口保留旧导出；旧源码路径可暂留薄 facade，迁移完成后由测试决定是否删除。
- 新包自动纳入 workspace、Turbo build、声明整理、pack smoke 和 Changesets；根 coverage 显式 filter 需加入新包。
- 每个子任务独立验证并可回滚；父任务只在四个子任务完成后执行跨包集成门禁。

## 回滚

- 子任务 1 可通过恢复 AI 文档助手内部实现回滚，不删除新增兼容测试。
- 子任务 2/3/4 尚未发布时可整体移除 `@moluoxixi/i18n-tool`，不影响 AI 文档助手。
- 写盘功能默认保持 preview/apply gate；任何回滚不得临时改为未经预览直接写文件。
