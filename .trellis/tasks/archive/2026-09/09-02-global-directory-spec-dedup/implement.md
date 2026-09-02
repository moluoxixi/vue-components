# 实施计划

- [x] 建立 `.trellis/spec/directory-structure.md` 全仓权威规范。
- [x] 将 ConfigForm Core 重复章节收敛为公共规范引用和领域补充。
- [x] 将 Designer、Docs、VitePress Theme 的真实目录规范整理为包级专项补充。
- [x] 删除所有含占位标记的模板正文，重写有效 package/layer 索引。
- [x] 删除仅含模板的未注册遗留 spec 目录。
- [x] 注册已有的 AI Provider、I18n Tool 和 ConfigForm Workbench package，并迁移 Workbench 真实规范。
- [x] 检查重复正文、占位标记、旧链接和 Markdown 本地链接。
- [x] 运行 Trellis task 校验并检查限定范围内的 Git diff。
- [x] 完成任务记录、归档并写入开发日志。

## 验证命令

```powershell
python ./.trellis/scripts/get_context.py --mode packages
python ./.trellis/scripts/task.py validate 09-02-global-directory-spec-dedup
rg -n "To be filled by the team|To fill" .trellis/spec
rg -n "directory-structure\.md" .trellis/spec --glob "*.md"
```

另运行 Markdown 相对链接解析检查，并对 `.trellis/spec/**/*.md` 重新统计内容哈希。

## 变更边界

- 只修改 `.trellis/spec`、`.trellis/config.yaml` 和当前任务/归档/会话记录。
- 不触碰产品源码、测试源码、构建配置和其他任务目录。
- 不覆盖无关工作树改动；迁移时保留现有真实 spec 内容。
