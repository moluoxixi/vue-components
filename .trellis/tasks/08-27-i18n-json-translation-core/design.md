# 国际化 JSON 适配与翻译核心设计

## 核心协议

- `ResourceDocument` 保存 adapter/layout/locale/namespace/resource ID、format metadata 与原始 tree。
- `TranslationUnit` 保存结构化 identity、真实 path、source key、value、semantics 与 origin。
- `LocaleAdapter` 统一 `scan`、`planTarget`、`serialize`、`roundTripValidate`，不访问真实 fs。
- `TranslationCandidate` 只通过 opaque unit ID 关联资源；`ChangeOperation` 是 server preview 的唯一输入。

## Adapter 规则

- Vue I18n：显式 locale pattern；nested 与 flat 分开；逻辑 key 冲突阻断写回。
- i18next：显式 namespace pattern；后缀原样保留；family 成组验证。
- generic：只提供 JSON layout 语义，不推断框架专属规则。
- 新 locale-per-file 复用 source 相对路径模板与格式；locale-first 在同一文件追加根 locale。

## 翻译编排

- 分析器默认输出 missing/empty units，overwrite 单独标记。
- batch 受条目数和字符数双重限制；共享常量由 server/UI 同时引用。
- 模型返回 JSON 由 Zod runtime schema 校验；随后执行 identity、locale、数量、token multiset、tag 与 family 校验。
- 部分失败按 unit/family 返回，不让合法候选被坏条目污染；retry 只处理失败子集。

## Round-trip

serialize 后重新 parse + adapter scan，比较：

1. 未修改 unit identity/value 不变。
2. 计划 create/update 精确出现。
3. namespace/locale/path/key style/family 不变。
4. format metadata 在承诺范围内保持。
