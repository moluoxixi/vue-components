# Zod 3 to Rule

`@moluoxixi/zod3-to-rule` 提供可序列化校验规则与 Zod 3 之间的桥接，不依赖 Vue 或任何表单 UI。

规则 JSON 是稳定协议。外部输入先通过 `parseRuleSet()` 严格解析，再使用 `compileRules()` 编译为 Zod schema、required 元数据和跨字段/custom validator。`rulesToZod()` 只编译单字段 Zod 能力。

```ts
import { compileRules, parseRuleSet } from '@moluoxixi/zod3-to-rule'

const parsed = parseRuleSet({
  version: 1,
  base: { type: 'string' },
  rules: [
    { kind: 'required', message: '请输入邮箱' },
    { kind: 'email', message: '邮箱格式不正确' },
  ],
})

if (parsed.success) {
  const compiled = compileRules(parsed.data)
  compiled.schema.safeParse('user@example.com')
}
```

支持的基础类型包括 string、number、boolean、date、enum 和 JSON primitive literal。内置规则覆盖字符串长度、regex、email、URL、UUID、数值范围、integer、finite、multipleOf、日期范围、required、基础跨字段比较和命名 custom validator。

`zodToRules()` 是受限的最佳努力导出器。它支持上述基础类型和 Zod 3 内置 checks，并返回结构化 diagnostics。`refine`、`superRefine`、transform、preprocess、coerce、default 和其他无法由规则 JSON 等价表达的行为不会被静默丢弃；存在不可恢复的 effects 或 coercion 时不会返回 `ruleSet`。
