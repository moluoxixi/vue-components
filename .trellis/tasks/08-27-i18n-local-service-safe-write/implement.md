# 国际化本地服务与安全写回实施计划

- [x] 实现 config 类型、defineConfig、发现、jiti loader、resolver 与 fixtures。
- [x] 实现严格 CLI parser、programmatic Vite server 和包内 UI static hosting。
- [x] 定义 shared protocol、limits、runtime decoders、错误码与 API client contract。
- [x] 实现 canonical root/resource registry、path containment 与 symlink/junction 防护。
- [x] 实现带 byte limit、content type、private header 和 same-origin 的 router 基础层。
- [x] 实现 scan registry、baseline hashing 与资源限额。
- [x] 接入翻译 SSE、终态协议、AbortSignal 和断连取消。
- [x] 实现 preview registry、diff、token/digest/stale 逻辑。
- [x] 实现 per-resource apply lock、round-trip revalidation 与 atomic text writer。
- [x] 覆盖 config/CLI/API/path/limit/conflict/atomic failure/abort 集成测试。
- [x] 运行 test/typecheck/build/pack，并用临时项目 smoke 启动 CLI。

## 回滚点

- translate 可在 scan API 稳定后接入；apply 在全部路径与冲突测试通过前保持禁用。
- 任何写回失败必须保留旧文件并清理 temp，测试不得通过删除该保护来规避平台差异。
