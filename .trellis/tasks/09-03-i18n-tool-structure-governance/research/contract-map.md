# I18n Tool 契约与测试映射

## 测试基线

- 约 68 个 unit 覆盖 config、core adapters/analysis/tokens/translation、filesystem/scanner、context、router与UI。
- 5 个 E2E 覆盖 create、overwrite、stale conflict、invalid/cancel 和 mobile。
- 缺口：CLI 只有 parseCliArgs 纯函数测试，没有进程级 output/exit characterization。

## 安全链

- browser 只发送 scan/resource/unit IDs、reviewed candidates与 previewToken。
- Preview 校验 freshness/overwrite/path/limit/round-trip；Apply 只接受 token并重新校验 path/hash/operation。
- Atomic multi-file failure reverse rollback；complete rollback 后 token可重用，不完整 rollback 后消费 token。

## 关键错误

- INVALID_REQUEST 400；PATH_OUTSIDE_ROOT/SYMLINK_ESCAPE 403；PAYLOAD_TOO_LARGE 413。
- PREVIEW_REQUIRED/PREVIEW_STALE/WRITE_CONFLICT 409；WRITE_FAILED 500；translation concurrency LIMIT_EXCEEDED 429。
- SSE 成功/失败只有一个 terminal；client disconnect abort模型调用。

## 发布验证

- Packed Node 验证 config/core/server；packed browser只允许 protocol并扫描 server-only fragments。
- CLI/E2E literal `dist/cli.js` 保持不变；hash chunks和 UI assets不是 public API。
