# 真实项目源码与页面预览架构

> 需求澄清：本文件记录的是“独立 Designer 连接外部目标项目”的早期假设。用户随后明确产品本体就是在线网站工作台，Config / 设计器 / Source 共同驱动站内 Page Preview。当前推荐方案见 `online-website-workbench.md`；外部项目桥不再是默认产品模型。

## 产品目标

同一份表单在 Designer 中具有三种可切换、语义一致的形态：

1. 拖拽设计器；
2. Config；
3. 真实项目 Source。

页面预览不是第四份配置，而是当前有效文档在目标项目真实运行上下文中的即时渲染结果。

## 当前能力与缺口

- 当前画布直接渲染 material 的 Designer/Runtime 组件，交互模型与保存文档隔离：`packages/ConfigForm/designer/src/components/DesignerNodePreview.vue:45`。
- 当前 Preview 只在点击后编译文档，并在弹窗中渲染裸 `ConfigFormRenderer`：`packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:176` 和 `packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:426`。
- Renderer 只接收字段树、组件 registry、布局和绑定，不拥有目标项目的 router、store、app plugin、API 或 mock：`packages/ConfigForm/runtime/src/renderer/types.ts:49`。
- 当前 ConfigForm devtools Vite plugin 仅开发态生效，通过 transform 定位源码，并提供 open-in-editor HTTP endpoint；它不读取或写回项目文件：`packages/ConfigForm/devtools-vite-plugin/src/index.ts:50`。
- Designer 当前只通过 `update:document` 输出受控 JSON，不依赖 Vite 或 Node：`packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:93`。

## 推荐架构

```text
Designer workbench
  ├─ Design view
  ├─ Config view
  ├─ Source view
  └─ Page preview surface
          │
          ├─ in-memory document messages
          ▼
target project preview route (iframe)
  ├─ real app bootstrap / router / layout
  ├─ real global CSS and component registry
  ├─ real provide / store / API / mock context
  └─ ConfigFormRenderer

Designer host adapter
          │
          ▼
Vite devtools project bridge
  ├─ source entry read
  ├─ parse / validate / revision
  ├─ atomic source write
  └─ Vite watcher / HMR
```

### Designer core

- 继续只管理 `DesignerDocument`、history、diagnostics 和三种工作视图，不直接调用文件系统。
- 提供平台无关的 project host adapter，负责加载 entry、保存 revision 和报告外部变更。
- 三种形态共享一份有效文档；Config/Source 编辑使用独立 draft，验证成功后才原子替换有效文档。

### 真实项目 Source

- Source 必须对应目标项目实际 import 的文件或明确生成区域，不是仅供复制的示例代码。
- 推荐首版使用 Designer 独占的声明式 TypeScript form module，由真实 page import；它仍是项目源码，并提供最可靠的双向转换。
- 若必须内嵌到现有 `.vue` / `.tsx`，只允许修改带稳定 marker 和 revision 的单一区域，保留其余手写 imports、hooks 和 page 代码。
- 不承诺把任意完整 Vue page 反编译为 Config。Designer 只拥有表单声明区域，page 其他代码保持项目所有。

### 页面实时预览

- 推荐通过 iframe 加载目标项目内专用 preview route，而不是在 Designer 包内复制项目 bootstrap。
- preview route 运行于真实项目 Vite 应用中，因此自然获得全局样式、router layout、业务组件、provide/store、API/mock 和 HMR。
- Designer 通过明确 `targetOrigin` 的 `postMessage` 发送带 revision 的有效 `DesignerDocument`；preview route 回传 ready、render error、viewport 和尺寸状态。
- 拖拽、Config 或 Source draft 只有在形成有效文档后才更新页面预览；无效文本显示诊断并保留最后一个有效页面。
- 为避免每次拖拽都写磁盘，实时预览优先传内存文档；真实项目 Source 通过显式保存或稳定 debounce 写回，保存后由 Vite watcher/HMR 接管。

## 最小安全项目桥

- 项目配置显式声明 `entry id -> canonical path` 与 preview URL；浏览器不能提交任意绝对路径。
- 读写目标必须经过 `realpath` 根目录校验、regular-file 和扩展名检查，并限制文件与请求体大小。
- 保存携带 `expectedRevision`；外部编辑导致 revision 不匹配时返回冲突，不静默覆盖。
- 写入前完成 source parse、`parseDesignerDocument`、registry analysis 和 codec dry-run，再使用同目录临时文件原子替换。
- 读写 API 保持开发态、同源、nonce 授权；生产 Runtime 不暴露文件系统能力。

## 当前任务边界

本能力属于下一阶段独立任务。本轮 UI 优化只需让中央工作区和工具栏具备后续扩展设计，不显示不可用的 Config/Source/Page Preview 占位入口。
