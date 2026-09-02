# 设计：全局目录规范与 Spec 去重

## 目标结构

```text
.trellis/spec/
  directory-structure.md                 # 全仓权威目录规范
  guides/                                # 仅保留 thinking guides
  <registered-package>/
    <layer>/
      index.md                           # 路由入口
      <package-specific-guide>.md        # 仅真实专项约束
```

## 路由与上下文

- 每个有效 package/layer 保留 `index.md`，其中以 `../../directory-structure.md` 链接公共规范。
- SessionStart 只列出 package/layer 索引路径；公共正文由相关索引按需读取，不加入全局自动注入。
- 不将代码规范放进 `.trellis/spec/guides`，该目录继续只承载思考清单。

## 内容归属

- 公共正文吸收 `config-form-core/frontend/directory-structure.md` 中可泛化的职责拆分契约，并改写 ConfigForm 专属示例和测试描述为全仓规则。
- `config-form-designer`、`docs`、`vitepress-theme-element-plus` 的有效目录文档改名为明确的 package structure 补充，并在开头声明继承公共规范。
- `config-form-core/architecture-documentation.md` 中重复的完整目录章节收敛为对公共规范的引用以及 ConfigForm 专属 hard-cut 补充。
- 纯模板文件直接删除；索引仅列公共规范和仍存在的专项规范。

## 遗留目录

对不在 `.trellis/config.yaml` package 映射中的 spec 目录：

- `dist`、`frontend`、`node_modules`、`plugin-shadcn-vue` 仅含模板，删除。
- `ai-provider`、`i18n-tool` 对应真实 workspace package 且含有效规范，补齐 package 映射并保留。
- `ConfigForm/frontend/quality-guidelines.md` 的有效内容属于 Workbench，清除残余模板段后迁移到 `config-form-workbench/frontend`，并注册该 package。

## 风险与回滚

- 风险：误删用户刚补充的规范。控制方式是基于当前工作树内容而非 HEAD 判定，含真实约束的四份目录文档逐份人工迁移。
- 风险：相对链接失效。通过 Markdown 链接解析器和 `rg` 检查旧路径。
- 回滚：本任务变更通过 Git diff 可逐文件恢复；不改产品代码。
