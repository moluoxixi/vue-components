# 实施计划：校验合同、属性稳定性与原生源码导出

## 阶段 1：合同与版本原子切换

- [x] 在 `zod3-to-rule` 将 RuleSet 升至 v2，删除 Required descriptor、编译输出和冲突逻辑，补旧/新/缺失/未知 shape 的 Reader 测试。
- [x] 在 Model 字段、settings、patch、schema、transfer、模板与 fixture 增加 `required` / `requiredMessage`，同步 ProjectDocument v7、SurfaceGraph v2。
- [x] 在 Compiler Canonical IR 中投影字段级 Required，同步 IR v6、Compiler 7.0.0、strict-key guard、hash/identity 和 fixture。
- [x] 同步所有 Runtime Host/transfer/protocol guard 的嵌套版本断言，不改变无 shape 变化的外层协议版本。
- [x] 先运行 RuleSet、Model、Compiler 的定向测试和 typecheck，确认没有半兼容状态再进入 UI 层。

## 阶段 2：Vue backend、Designer 与 Workbench 稳定性

- [x] Vue backend 从字段合同投影 Required，移除完整业务规则对默认值的编译期否决，仅保留 base 类型诊断。
- [x] Designer 将 Material `valueKind` 传给 validation setter，按类型限制 base 和规则；Required/Required message 使用独立字段级 setter；`time` 只开放 Required/validateOn，不伪造 date base。
- [x] 多选字段只开放可安全批量提交的 Required 能力；`multiselect` 首版不创建伪 string RuleSet。
- [x] 属性命令失败时将本地控件回滚到权威 graph，同时保留 command diagnostic；覆盖 Field 空值和重复值。
- [x] 统一 Options 与默认值的 Provider value 类型能力，使用显式 clear intent；同一命令同步 options、enum/literal validation 与失效默认值，单次 Undo 整体恢复。
- [x] Regex/日期/数字规则使用本地 draft 和合法提交点，避免把正常输入中间态写进 Model。
- [x] 将 Workbench command 与 compile diagnostics 分槽管理，编译失败保留最后成功 artifact；作者外壳、Layers 和 Inspector 不依赖 artifact 成功挂载。
- [x] Runtime Host JSON model 改为 `shallowRef`，保留 `cloneWorkbenchJson` detached plain-data 边界。
- [x] 添加单元回归：Boolean/Number 启用校验、空文本 Required、非法中间值、编译失败后恢复、诊断不互相覆盖、Proxy 不越界。

## 阶段 3：Raw Vue 与双导出边界

- [x] 拆分 component resolver 与 ConfigForm binding resolver，使 `generateVueSource` 不感知 binding API。
- [x] 生成项目内的直接 TypeScript validator，覆盖字段级 Required、base、optional/nullable、内建规则、compare 和稳定消息。
- [x] 对 `custom`、未知规则、非法 regex/date/type 输入生成期 fail closed；`multipleOf` 使用十进制缩放算法。
- [x] 从 Raw manifest、源码和消费测试移除 `zod`、`@moluoxixi/zod3-to-rule` 及所有内部软链。
- [x] Workbench export snapshot 改为每 mode 独立 `ready | failed`；导出弹窗按当前 mode 展示文件或诊断，并独立控制复制/下载。
- [x] 保持 ConfigForm binding 只引用公开绑定包，不内嵌 App/router/session/reducer/overlay 核心。

## 阶段 4：自动化与真实浏览器验证

- [x] 运行受影响包单测：`zod3-to-rule`、Model、Compiler、Vue backend、Runtime、Designer、两个 Designer adapter、Source、Workbench。
- [x] 运行上述包 typecheck，并运行 Source/Workbench build 与根架构边界测试。
- [x] 在工作区外临时目录分别生成 Element Plus、Ant Design Vue Raw 工程，真实安装后执行 typecheck/build；验证全文件和 manifest 依赖白名单，且未创建内部软链。
- [x] 执行双 Provider 属性压力测试：Text、Boolean、Number、Select，连续切换 Properties/Validation，编辑默认值、Required、message、validateOn、规则增删。
- [x] 覆盖 Field 空值/重复值拒绝回滚、空字符串 option、Provider 禁止类型、options 增删改排序及 validation/default 引用完整性。
- [x] 每一步断言 DesignSurface、Layers、Inspector 仍存在；收集主页面与全部 iframe 的 `console.error`、`pageerror` 和错误文本，要求为零。
- [x] 故意制造可恢复的编译错误，验证最后成功画面、可见诊断、原地修复、undo/redo/jump；等待自动保存并重载后继续编辑。
- [x] 运行 Workbench Playwright 任务场景与完整 a11y 矩阵，并确认用例使用当前真实控件和 accessible name；完整历史 E2E 中的既有导航/截图基线失败单独记录，不以放宽断言掩盖。
- [x] 执行 Raw/Experience 校验与交互 parity 场景，不以字符串快照代替运行行为。

## 推荐命令

```powershell
pnpm --filter @moluoxixi/zod3-to-rule test
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-compiler test
pnpm --filter @moluoxixi/config-form-vue-backend test
pnpm --filter @moluoxixi/config-form test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @moluoxixi/config-form-designer-element-plus test
pnpm --filter @moluoxixi/config-form-designer-antd-vue test
pnpm --filter @moluoxixi/config-form-source test
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench test:e2e
```

各包随后执行对应 `typecheck`；Vue backend、Source 与 Workbench 执行 `build`。包名以各自 `package.json` 为准，如脚本过滤名不同，在实施前先用 `pnpm --filter` 列表校正。

## 风险文件与停点

- `packages/zod3-to-rule/src/**`、`packages/ConfigForm/model/src/**`、`packages/ConfigForm/compiler/src/**`：版本必须一次切换，任一 Reader/fixture 未同步即停止后续实现。
- `packages/ConfigForm/workbench/src/session/services/workbench-design.ts` 与 `src/app/index.vue`：不得用隐藏诊断或保留陈旧 graph 来伪造稳定。
- `packages/ConfigForm/source/src/generator/services/emitter.ts`：不得复制通用 Runtime；若本地 validator 开始承担状态机职责，回到设计评审。
- `packages/ConfigForm/workbench/src/project/export/**`：独立失败仍必须锁定同一 compilation identity。

## 完成门禁

- [x] PRD AC1-AC10 全部有自动化或浏览器证据。
- [x] `git diff` 不包含旧 Required 兼容层、事件域复活、内部 Raw 依赖或无关重构。
- [x] 更新相关 `.trellis/spec`、README/ROADMAP 与 Changeset，使文档合同和实现一致。
- [x] 由独立检查代理复核 spec、lint/typecheck/test、跨层数据流和生成消费边界。

## 最终验证记录（2026-09-20）

- 包测试通过：RuleSet `14/14`、Model `54/54`、Compiler `19/19`、Vue backend `10/10`、Runtime `135/135`、Designer `118/118`、Element adapter `26/26`、Ant adapter `15/15`、Source `85/85`、Workbench `544/544`。
- ConfigForm 专项架构边界 `7/7` 通过；Project/Surface v7/v2 JSON 导入 `4/4`、双 Provider 属性压力回归 `2/2`、完整 a11y 矩阵 `8/8` 通过。
- 受影响包 typecheck 通过；Source、Designer、Vue backend、Workbench build 通过；全部改动文件 ESLint 与 `git diff --check` 通过。
- `pnpm changeset status` 退出码为 `0`；输出仅包含仓库既有 peer 版本提示。
- 范围外既有基线：完整历史 Workbench E2E 仍有 18 个旧导航/accessible-name 断言和 16 个缺失 Windows 截图基线；本任务未放宽断言或更新截图掩盖。
- 范围外既有基线：全仓 `pnpm test:package-architecture` 仍被未修改的 `packages/qiankun-router-kit` 与 `packages/vite-plugin-style-scope` 共 27 项未登记架构诊断阻断。
