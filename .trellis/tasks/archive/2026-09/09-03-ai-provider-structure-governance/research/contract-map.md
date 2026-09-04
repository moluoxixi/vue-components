# AI Provider 契约与测试映射

## 公开消费者

- AI-doc shared：`AiRuntimeStatus`、`EmbeddingProviderId`；server：target types、guards、factories、status。
- I18n Tool shared：`AiProviderId`；server：`LanguageModelTarget`、`createLanguageModel`。
- consumer builds 已 externalize `@moluoxixi/ai-provider` 全部 subpath；无源码 deep import。

## 现有测试

- 20 个执行案例覆盖 chat 4 Provider、embedding 3 Provider、基础 target validation、unknown provider、secret-free status、error cause 与 redaction。
- entry test 只覆盖 shared/server，缺 root/shared 等价以及 cause/redaction 的 browser-safe 负向断言。
- compatible URL 缺 whitespace、非 HTTP scheme、query、fragment；embedding target 缺相同 validation matrix。

## 稳定行为

- chat 支持 OpenAI、Anthropic、Google、OpenAI-compatible；embedding 不支持 Anthropic。
- `baseURL` 必须是无 credentials/query/fragment 的绝对 HTTP(S) URL，并移除尾部 `/`。
- error 公共对象不含 cause；cause 只可经 server getter 读取。
- status 只暴露 availability/provider/model，不暴露 apiKey/baseURL。
- redaction 覆盖 raw、URI 与 form encoded secret，percent escape 大小写不敏感。
