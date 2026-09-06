# 实施计划

1. 建立扩展工厂和 editor controller，迁移现有初始化、同步、editable 与事件逻辑。
2. 建立工具栏状态/命令描述，抽取默认工具栏组件并保持 slot 替换行为。
3. 抽取链接面板组件，收紧 URL 规范化并补充纯函数测试。
4. 更新主组件组合逻辑和必要的类型 barrel，保持公开入口不变。
5. 补齐组件、composable、工具函数测试，运行包级 lint、typecheck、test、build 与架构检查。

验证命令：

- `pnpm --filter @moluoxixi/rich-text-editor lint`
- `pnpm --filter @moluoxixi/rich-text-editor typecheck`
- `pnpm --filter @moluoxixi/rich-text-editor test`
- `pnpm --filter @moluoxixi/rich-text-editor build`
- `pnpm check:package-architecture`
