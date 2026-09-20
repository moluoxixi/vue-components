# 已确认产品决策

## 定位

- ConfigForm Studio 是本地优先的高保真业务界面 Demo 创作应用。
- 工程师是主要用户，UI 设计师经过少量学习可独立使用。
- Designer 负责单个界面，Runtime 继续服务生产代码，Source 负责单向源码交付。
- Demo 不调用接口；程序员在导出后补充真实数据、事件函数和业务逻辑。

## 创作内容

- 项目包含 Page、Dialog、Drawer、Dataset 和静态 Resource。
- Page/Dialog/Drawer 是独立 SurfaceAsset；Material 是组件类型；运行打开产生 SurfaceInstance。
- Dialog/Drawer 独立设计，可复用、传参、返回具名结果，并允许用户动作产生任意有限深度或循环的实例栈。
- 设计模式聚焦当前 Surface，体验模式执行真实页面历史与浮层栈。

## 交互

- 状态表达式控制显隐、禁用、只读、必填和白名单展示属性。
- 值动作支持 set/copy/clear，字段变化后执行，初始化时不执行。
- 一个语义触发器只有一个主要 UI 动作：导航、返回、打开或关闭。
- 动作可要求先校验；表达式非法时阻止体验和导出。
- 不恢复原始事件名、函数、动作链或 Flow。

## 数据与 UI

- Dataset 根为对象数组，允许嵌套 JSON，运行期只读。
- Dataset 支持 options、Table、List 投影和本地搜索/筛选/排序/分页。
- 字段 value 仍为 string/number，不保存整行对象。
- 提供业务展示/操作/数据物料、项目 Design Token、受控视觉属性和响应式 Grid/Flex。
- 不提供任意 CSS、绝对定位自由画布或首版自定义组件。

## 交付

- Studio 使用 IndexedDB 自动保存和项目 JSON 导入导出，不做云端与协作。
- 源码导出保留全部 Demo 行为，直接可运行，不生成接口占位或 handler stub。
- 源码交付后不支持反向导入 Designer。
- Component adapter 创建项目时锁定，Element Plus 与 Ant Design Vue 维护共同基础能力。
- 所有合同硬切升版，不保留旧模型或兼容层。
