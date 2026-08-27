# 国际化 JSON 适配与翻译核心

## 目标

在 `@moluoxixi/i18n-tool` 内建立与 UI、HTTP 和磁盘授权无关的国际化领域核心：统一资源模型、Vue I18n/i18next/通用 JSON 适配器、缺失项分析、占位符与结构保护，以及基于 `@moluoxixi/ai-provider` 的 AI 翻译编排。

## 需求

### R1. 统一资源模型

- 单元 identity 必须结构化包含 adapter、resource ID、locale、namespace、真实 JSON path 和原始 key，不能仅使用 dotted key。
- 文档元数据保留布局、key style、缩进、EOL、末尾换行、根键顺序与原始 key 顺序。
- MVP 只接受 string 叶值；array、number、boolean 和 null 返回明确 unsupported 诊断。

### R2. JSON 适配器

- Vue I18n 支持 locale-per-file、nested object 与 flat dotted keys，并识别二者冲突而不自动合并。
- i18next 保留显式 namespace 映射、plural/context 后缀及组合 family；未知 convention 下把后缀视为 opaque key，不虚构语义。
- 通用 JSON 支持 locale-per-file 与 locale-first 单文件布局，不推断 Vue I18n 或 i18next 专属语义。
- 适配器负责目标文件/locale 分支命名、解析、序列化和语义 round-trip 校验；通用核心不硬编码供应商路径约定。

### R3. 翻译与保护

- 默认计算目标语言中缺失或为空的条目；已有非空译文标记为 overwrite-required。
- AI 请求只携带 opaque unit ID、源文本和受保护 token manifest，不让模型决定路径、key、locale、namespace 或后缀。
- 运行时 schema 验证返回条目数量、ID、目标语言和字符串值。
- token 校验使用多重集，至少保护 `{name}`、i18next `{{name}}`/未转义标志、printf 占位符、转义换行和 HTML/XML tag 结构。
- plural/context family 必须成组提交和校验，成员缺失、新增或重命名均拒绝。
- 支持有界批次、部分失败定位、显式重试与 `AbortSignal`；已开始的流不透明重试。

### R4. 变更计划

- 核心输出纯结构化 create/update operation，包含 resource ID、JSON Pointer、before/after、overwrite-required 和诊断，不直接写磁盘。
- serialize 后必须 JSON parse，再由同一适配器重新 scan；所有未改单元和计划变更的 identity/value 必须精确匹配。

## 验收标准

- [x] fixtures 覆盖 Vue I18n flat/nested/冲突、通用两种布局和 i18next namespace/plural/context 组合。
- [x] nested path 与 literal dotted key 不发生 identity 碰撞。
- [x] 新目标 locale/file 的结构、命名与 adapter 配置一致。
- [x] 占位符增删、重命名、计数变化、tag 失配、family 成员变化和非字符串输出均被拒绝。
- [x] AI 输出非法 JSON、ID/数量/locale 不符和部分失败具有稳定诊断，不能生成可 apply operation。
- [x] 语义 round-trip 证明未修改内容和结构不漂移。
- [x] 单元测试、类型检查、构建与声明验证通过。

## 范围外

- TypeScript/JavaScript、YAML、PO、ARB 资源。
- 自动识别任意动态 i18next convention。
- HTTP API、路径授权、磁盘写回和 Vue UI。

## 依赖

- 依赖 `08-27-shared-ai-provider-migration` 稳定共享 transport 与错误契约。
