# @moluoxixi/i18n-tool

本地国际化翻译工作台。工具在项目本地启动 HTTP 服务，读取配置指定的 JSON 语言资源，通过 Vercel AI SDK 调用 OpenAI、Anthropic、Google 或 OpenAI-compatible 模型生成译文，并在预览确认后创建或更新本地文件。

## 能力

- Vue I18n locale-per-file JSON，支持 nested object 与 flat dotted keys。
- i18next locale-per-file JSON，支持显式 namespace、plural 与 context convention。
- 通用 locale-per-file 和 locale-first JSON。
- 缺失项扫描、批量 AI 翻译、候选编辑、逐项接受/拒绝和失败重试。
- 占位符、printf、Vue linked message、plural pipe 与 HTML tag 结构保护。
- `scan -> preview -> apply` 写回，包含文本 diff、overwrite 二次确认、baseline 冲突检测和原子替换。
- 密钥仅存在于本地服务进程，浏览器只读取脱敏状态。

## 安装

```bash
pnpm add -D @moluoxixi/i18n-tool
```

## 公开入口

| 入口                            | 用途                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| `@moluoxixi/i18n-tool`          | JSON adapter、分析、翻译计划与安全变更的核心 API             |
| `@moluoxixi/i18n-tool/core`     | 与根入口等价的显式 Core 入口                                 |
| `@moluoxixi/i18n-tool/config`   | `defineConfig`、配置 schema、发现、加载与解析                |
| `@moluoxixi/i18n-tool/protocol` | browser-safe HTTP/SSE wire types、schema 与 decoder          |
| `@moluoxixi/i18n-tool/server`   | 扫描、path guard、preview/apply、atomic write 与 Vite plugin |

CLI 通过 `pnpm exec i18n-tool` 使用，不提供 `./cli` import subpath。工作台 UI 随 CLI 打包到 `dist/ui`，不是独立的组件 API。

在项目根目录创建 `i18n-tool.config.ts`：

```ts
import { defineConfig } from '@moluoxixi/i18n-tool/config'

export default defineConfig({
  root: '.',
  resources: {
    adapter: 'vue-i18n-json',
    include: ['locales/**/*.json'],
    layout: 'locale-per-file',
    keyStyle: 'nested',
    localePattern: 'locales/{locale}.json',
    sourceLocale: 'zh-CN',
    targetLocales: ['en-US', 'ja-JP'],
  },
  ai: {
    provider: 'openai-compatible',
    baseUrl: 'https://gateway.example/v1',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'I18N_TOOL_AI_API_KEY',
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    open: true,
  },
})
```

`provider`、`model` 和 `apiKeyEnv` 必须显式配置。原生 `openai`、`anthropic`、`google` Provider 不接受 `baseUrl`；只有 `openai-compatible` 必须提供不含凭据、query 或 fragment 的 HTTP(S) `baseUrl`：

```ts
import { defineConfig } from '@moluoxixi/i18n-tool/config'

export default defineConfig({
  ai: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
})
```

配置密钥并启动：

```bash
ANTHROPIC_API_KEY=your-key pnpm exec i18n-tool
```

也可以显式指定配置和服务参数：

```bash
pnpm exec i18n-tool --config ./i18n-tool.config.ts --port 5180 --open
```

## i18next

i18next 的 plural/context convention 必须显式配置，未知后缀会保持为普通 key：

```ts
import { defineConfig } from '@moluoxixi/i18n-tool/config'

export default defineConfig({
  resources: {
    adapter: 'i18next-json',
    include: ['locales/**/*.json'],
    layout: 'locale-per-file',
    keyStyle: 'flat',
    localePattern: 'locales/{locale}/{namespace}.json',
    namespace: 'common',
    sourceLocale: 'en',
    targetLocales: ['zh-CN'],
    adapterOptions: {
      pluralForms: ['one', 'other'],
      contexts: ['female', 'male'],
    },
  },
})
```

## 安全边界

- 只扫描配置 root 内的相对资源路径，拒绝 traversal、symlink/junction 逃逸和目标路径碰撞。
- 浏览器不能提交绝对路径或任意磁盘 operation。
- 已有非空译文默认不选中；重译需要行级授权，并在 apply dialog 中再次确认。
- preview 后文件发生变化会返回冲突，不提供强制覆盖。
- MVP 不扫描或写回 TypeScript、JavaScript、YAML、PO 或 ARB。
